// src/realtime/realtime.gateway.ts
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Prisma, MessageKind } from '@prisma/client';
import { TwilioVideoService } from './twilio-video.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';

type JwtPayload = { sub: string; email: string };
type CallKind = 'AUDIO' | 'VIDEO';

@WebSocketGateway({
  cors: { origin: process.env.CLIENT_APP_URL || true, credentials: true },
  namespace: '/ws',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() io: Server;

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private presence: PresenceService,
    private twilio: TwilioVideoService, // ⬅️ Twilio integration
  ) {}

  afterInit() {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization?.split(' ')[1] ?? '');

      if (!token) throw new Error('No token');

      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      socket.data.userId = payload.sub;

      await this.presence.setOnline(payload.sub);
      this.io.emit('presence:update', { userId: payload.sub, online: true });

      socket.join(`user:${payload.sub}`);
      socket.emit('connection:ok', { userId: payload.sub });
    } catch {
      socket.emit('connection:error', { message: 'Unauthorized' });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string;
    if (userId) {
      await this.presence.setOffline(userId);
      this.io.emit('presence:update', { userId, online: false });
    }
  }

  // ---------- helpers ----------
  private room(conversationId: string) {
    return `conv:${conversationId}`;
  }

  private async ensureMembership(conversationId: string, userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { conversationId, userId },
      select: { id: true },
    });
    return !!membership;
  }

  // ---------- chat events ----------
  @SubscribeMessage('conversation:join')
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const userId = socket.data.userId as string;
    if (!userId) return;

    const isMember = await this.ensureMembership(body.conversationId, userId);
    if (!isMember) {
      socket.emit('error', { code: 'NOT_MEMBER', message: 'Not a member of this conversation' });
      return;
    }

    socket.join(this.room(body.conversationId));
    socket.emit('conversation:joined', { conversationId: body.conversationId });
    socket.to(this.room(body.conversationId)).emit('presence:update', { userId, online: true });
  }

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: {
      conversationId: string;
      kind?: MessageKind;
      content: any;
      clientId?: string;
    },
  ) {
    const userId = socket.data.userId as string;
    if (!userId) return;

    const member = await this.prisma.membership.findFirst({
      where: { conversationId: body.conversationId, userId },
      select: { id: true },
    });
    if (!member) {
      socket.emit('error', { code: 'NOT_MEMBER', message: 'Not a member of this conversation' });
      return;
    }

    try {
      const msg = await this.prisma.message.create({
        data: {
          conversationId: body.conversationId,
          senderId: userId,
          kind: body.kind ?? 'TEXT',
          content: body.content as Prisma.InputJsonValue,
        },
        select: {
          id: true, conversationId: true, senderId: true,
          kind: true, content: true, createdAt: true,
        },
      });

      const otherMembers = await this.prisma.membership.findMany({
        where: { conversationId: body.conversationId, userId: { not: userId } },
        select: { userId: true },
      });
      if (otherMembers.length) {
        await this.prisma.receipt.createMany({
          data: otherMembers.map(m => ({ messageId: msg.id, userId: m.userId, status: 'DELIVERED' })),
          skipDuplicates: true,
        });
      }

      this.io.to(this.room(body.conversationId)).emit('message:new', { ...msg, clientId: body.clientId });
      socket.emit('message:ack', { messageId: msg.id, clientId: body.clientId });
    } catch {
      socket.emit('error', { code: 'SEND_FAILED', message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string; on: boolean },
  ) {
    const userId = socket.data.userId as string;
    socket.to(this.room(body.conversationId)).emit('typing', { userId, on: body.on });
  }

  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { messageId: string },
  ) {
    const userId = socket.data.userId as string;
    const msg = await this.prisma.message.findUnique({
      where: { id: body.messageId },
      select: { id: true, conversationId: true, createdAt: true },
    });
    if (!msg) return;

    const isMember = await this.prisma.membership.findFirst({
      where: { userId, conversationId: msg.conversationId },
      select: { lastReadAt: true },
    });
    if (!isMember) return;

    await this.prisma.receipt.upsert({
      where: { messageId_userId: { messageId: msg.id, userId } },
      create: { messageId: msg.id, userId, status: 'READ' },
      update: { status: 'READ', at: new Date() },
    });

    const next = isMember.lastReadAt && isMember.lastReadAt > msg.createdAt
      ? isMember.lastReadAt
      : msg.createdAt;

    await this.prisma.membership.updateMany({
      where: { userId, conversationId: msg.conversationId },
      data: { lastReadAt: next },
    });

    this.io.to(this.room(msg.conversationId)).emit('message:read', { messageId: msg.id, userId });
  }

  // ---------- Twilio calling (DM + Group) ----------
  /**
   * Start a call: ensure room, mint token for starter, notify others to join.
   * payload: { conversationId: string, kind: 'AUDIO' | 'VIDEO' }
   * emits:
   *  - to starter: call:started { roomName, token, kind }
   *  - to others:  call:ring    { roomName, fromUserId, kind }
   */
  @SubscribeMessage('call:start')
  async onCallStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string; kind: CallKind },
  ) {
    const userId = socket.data.userId as string;
    if (!userId) return;

    const isMember = await this.ensureMembership(body.conversationId, userId);
    if (!isMember) {
      socket.emit('error', { code: 'NOT_MEMBER', message: 'Not a member' });
      return;
    }

    socket.join(this.room(body.conversationId));
    const room = await this.twilio.ensureRoom(body.conversationId);
    const token = this.twilio.generateToken(body.conversationId, userId);

    // Notify others in the conversation to show “incoming call”
    socket.to(this.room(body.conversationId)).emit('call:ring', {
      conversationId: body.conversationId,
      roomName: room.uniqueName,
      fromUserId: userId,
      kind: body.kind,
    });

    // Give the starter a token to connect with Twilio Video JS SDK
    socket.emit('call:started', {
      conversationId: body.conversationId,
      roomName: room.uniqueName,
      token,
      kind: body.kind,
    });
  }

  /**
   * Join an ongoing call: mint a token and send back peers can connect via Twilio SDK.
   * payload: { conversationId: string }
   * emits to joiner: call:joined { roomName, token }
   * broadcasts:      call:peer-join { userId }
   */
  @SubscribeMessage('call:join')
  async onCallJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const userId = socket.data.userId as string;
    if (!userId) return;

    const isMember = await this.ensureMembership(body.conversationId, userId);
    if (!isMember) {
      socket.emit('error', { code: 'NOT_MEMBER', message: 'Not a member' });
      return;
    }

    socket.join(this.room(body.conversationId));
    const room = await this.twilio.ensureRoom(body.conversationId);
    const token = this.twilio.generateToken(body.conversationId, userId);

    socket.emit('call:joined', {
      conversationId: body.conversationId,
      roomName: room.uniqueName,
      token,
    });

    socket.to(this.room(body.conversationId)).emit('call:peer-join', {
      conversationId: body.conversationId,
      userId,
    });
  }

  /**
   * End the call for everyone (server-complete the Room).
   * payload: { conversationId: string }
   * emits: call:ended
   */
  @SubscribeMessage('call:end')
  async onCallEnd(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const userId = socket.data.userId as string;
    if (!userId) return;

    const isMember = await this.ensureMembership(body.conversationId, userId);
    if (!isMember) return;

    await this.twilio.endRoom(body.conversationId);

    this.io.to(this.room(body.conversationId)).emit('call:ended', {
      conversationId: body.conversationId,
      endedBy: userId,
    });
  }

  // Optional UX helpers
  @SubscribeMessage('call:mute')
  onCallMute(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string; on: boolean },
  ) {
    const userId = socket.data.userId as string;
    socket.to(this.room(body.conversationId)).emit('call:peer-mute', {
      conversationId: body.conversationId,
      userId,
      on: body.on,
    });
  }

  @SubscribeMessage('call:camera')
  onCallCamera(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string; on: boolean },
  ) {
    const userId = socket.data.userId as string;
    socket.to(this.room(body.conversationId)).emit('call:peer-camera', {
      conversationId: body.conversationId,
      userId,
      on: body.on,
    });
  }
}
