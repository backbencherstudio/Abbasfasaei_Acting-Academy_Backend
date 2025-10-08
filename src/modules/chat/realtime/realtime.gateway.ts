import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessageKind } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_APP_URL || 'http://127.0.0.1:5500',
    credentials: true,
  },
  namespace: '/ws',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() io: Server;

  // In-memory caches / limits (sufficient for single-instance deployment)
  private usernameCache = new Map<string, { name: string | null; ts: number }>();
  private messageTimestamps = new Map<string, number[]>(); // userId -> send times (ms)
  private typingLastEmit = new Map<string, number>(); // key: userId:conversationId -> last emit ms

  // Config knobs
  private MESSAGE_RATE_WINDOW_MS = 10_000; // 10s sliding window
  private MESSAGE_RATE_LIMIT = 30; // max messages per window
  private USERNAME_CACHE_TTL_MS = 60_000; // 1 minute
  private TYPING_MIN_INTERVAL_MS = 1500; // throttle typing broadcast per user per conversation

  constructor(
    private jwt: JwtService,
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
    private prisma: PrismaService,
  ) {}

  private dbg(...args: any[]) {
    if (process.env.CHAT_DEBUG === '1') {
      // eslint-disable-next-line no-console
      console.log('[Realtime]', ...args);
    }
  }

  // Handle incoming connection
  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('No token');

      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      socket.data.userId = payload.sub;
      socket.join(`user:${payload.sub}`);
  this.dbg('connection', { sid: socket.id, userId: payload.sub });
      // Ensure user still exists (token may reference deleted user in dev environments)
      const userExists = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      if (!userExists) {
        socket.emit('connection:error', {
          code: 'USER_NOT_FOUND',
          message: 'User referenced by token does not exist',
        });
        socket.disconnect(true);
        return;
      }

      // Mark online (use updateMany to avoid throwing if race condition deletes user)
      await this.prisma.user.updateMany({
        where: { id: payload.sub },
        data: { lastSeenAt: null },
      });

      socket.emit('connection:ok', { userId: payload.sub });
      this.io.emit('presence:update', { userId: payload.sub, online: true });
      
    } catch (err) {
      socket.emit('connection:error', { code: 'UNAUTHORIZED', message: 'Unauthorized' });
      socket.disconnect(true);
    }
  }

  // Handle disconnection
  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string;
    if (userId) {
      try {
        await this.prisma.user.updateMany({
          where: { id: userId },
          data: { lastSeenAt: new Date() },
        });
      } catch (_) {
        // swallow; user might have been deleted concurrently
      }
      this.io.emit('presence:update', { userId, online: false });
    }
  }

  // Join a conversation room
  @SubscribeMessage('conversation:join')
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const userId = socket.data.userId as string;
    if (!userId) return;
    if (!body?.conversationId) {
      socket.emit('error:conversation', { code: 'BAD_REQUEST', message: 'conversationId required' });
      return;
    }
    try {
      this.dbg('onJoin:incoming', { userId, body });
      await this.conversationsService.ensureMember(body.conversationId, userId);
      socket.join(`conv:${body.conversationId}`);
      socket.emit('conversation:joined', { conversationId: body.conversationId });
      socket.to(`conv:${body.conversationId}`).emit('presence:update', { userId, online: true });
      this.dbg('onJoin:success', { userId, conversationId: body.conversationId, rooms: Array.from(socket.rooms) });
    } catch (err) {
      this.dbg('onJoin:failed', { userId, body, err: (err as any)?.message });
      socket.emit('error:conversation', { code: 'JOIN_FAILED', message: 'Not a member of conversation' });
    }
  }

  // Send a message
  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string; kind: string; content: any },
  ) {
    const { conversationId, kind, content } = body;
    const userId = socket.data.userId as string;

    if (!userId) {
      return { error: 'User not authenticated' };
    }

    // Lightweight body validation using zod to avoid malformed payloads
    // Accept Prisma cuid (not UUID) -> loosen validation to safe slug/id
    const schema = z.object({
      conversationId: z
        .string()
        .min(10)
        .max(100)
        .regex(/^[a-zA-Z0-9_-]+$/, 'invalid id'),
      kind: z.nativeEnum(MessageKind).default(MessageKind.TEXT),
      content: z.any().optional(),
    });
    const parseResult = schema.safeParse(body);
    if (!parseResult.success) {
      socket.emit('error:message', { code: 'BAD_MESSAGE', message: 'Invalid payload', issues: parseResult.error.issues });
      return;
    }

    // Rate limiting (sliding window)
    const now = Date.now();
    const windowStart = now - this.MESSAGE_RATE_WINDOW_MS;
    const stamps = this.messageTimestamps.get(userId) || [];
    const recent = stamps.filter((t) => t > windowStart);
    if (recent.length >= this.MESSAGE_RATE_LIMIT) {
      socket.emit('error:message', { code: 'RATE_LIMIT', message: 'Too many messages, slow down.' });
      return;
    }
    recent.push(now);
    this.messageTimestamps.set(userId, recent);

    try {
      await this.conversationsService.ensureMember(conversationId, userId);
      this.dbg('onSend:validated', { userId, conversationId, kind });
      const msg = await this.messagesService.sendMessage(
        conversationId,
        userId,
        (kind as MessageKind) || MessageKind.TEXT,
        content,
      );
      socket.to(`conv:${conversationId}`).emit('message:new', msg);
      // Echo back for unified stream UX
      socket.emit('message:new', msg);
      socket.emit('message:ack', { messageId: msg.id });
      this.dbg('onSend:delivered', { messageId: msg.id, conversationId, userId });
    } catch (e) {
      this.dbg('onSend:failed', { userId, conversationId, err: (e as any)?.message });
      socket.emit('error:message', { code: 'SEND_FAILED', message: 'Failed to send message' });
    }
  }

  // Handle typing event
  @SubscribeMessage('typing')
  async onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string; on: boolean },
  ) {
    const userId = socket.data.userId as string;
    if (!body?.conversationId) return;
    // Throttle typing events per user per conversation
    const key = `${userId}:${body.conversationId}`;
    const last = this.typingLastEmit.get(key) || 0;
    const now = Date.now();
    if (now - last < this.TYPING_MIN_INTERVAL_MS) return;
    this.typingLastEmit.set(key, now);

    try {
      // Username lookup w/ simple TTL cache
      const cached = this.usernameCache.get(userId);
      if (!cached || now - cached.ts > this.USERNAME_CACHE_TTL_MS) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        this.usernameCache.set(userId, { name: user?.name ?? null, ts: now });
      }
      const name = this.usernameCache.get(userId)?.name;
      socket.to(`conv:${body.conversationId}`).emit('typing', { userId, userName: name, on: body.on });
    } catch (_) {
      // swallow silently; typing is best-effort
    }
  }

  // Mark message as read
  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() b: { conversationId: string; at?: string },
  ) {
    const userId = socket.data.userId as string;
    await this.conversationsService.ensureMember(b.conversationId, userId);
    await this.messagesService.markRead(
      b.conversationId,
      userId,
      b.at ? new Date(b.at) : undefined,
    );
    this.io.to(`conv:${b.conversationId}`).emit('message:read', {
      conversationId: b.conversationId,
      userId,
      at: b.at ?? new Date().toISOString(),
    });
  }
}
