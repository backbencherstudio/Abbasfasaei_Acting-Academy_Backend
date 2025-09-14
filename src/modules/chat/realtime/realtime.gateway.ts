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

  constructor(
    private jwt: JwtService,
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
    private prisma: PrismaService,
  ) {}

  // Handle incoming connection
  async handleConnection(socket: Socket) {
    // console.log('Hit in handleConnection');

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

      // Notify others that this user is online
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { lastSeenAt: null }, // null means online
      });

      socket.emit('connection:ok', { userId: payload.sub });

      this.io.emit('presence:update', { userId: payload.sub, online: true });
      
    } catch (err) {
      socket.emit('connection:error', { message: 'Unauthorized' });
      socket.disconnect(true);
    }
  }

  // Handle disconnection
  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string;

    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() }, // This stores the time when user was last seen
      });

      this.io.emit('presence:update', { userId, online: false });
    }
  }

  // Join a conversation room
  @SubscribeMessage('conversation:join')
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    console.log('Hit in onJoin');
    const userId = socket.data.userId as string;
    if (!userId) return;

    console.log('Joining conversation:', body.conversationId);

    try {
      // Ensure the user is a member of the conversation
      await this.conversationsService.ensureMember(body.conversationId, userId);

      socket.join(`conv:${body.conversationId}`);
      socket.emit('conversation:joined', {
        conversationId: body.conversationId,
      });

      socket
        .to(`conv:${body.conversationId}`)
        .emit('presence:update', { userId, online: true });

      console.log('OnJoin completed');
    } catch (err) {
      socket.emit('error', { message: 'Failed to join the conversation' });
    }
  }

  // Send a message
  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string; kind: string; content: any },
  ) {
    console.log('Hit in onSend');
    const { conversationId, kind, content } = body;
    const userId = socket.data.userId as string;

    if (!userId) {
      return { error: 'User not authenticated' };
    }

    try {
      // Ensure the user is part of the conversation
      await this.conversationsService.ensureMember(conversationId, userId);

      // Send the message
      const msg = await this.messagesService.sendMessage(
        conversationId,
        userId,
        kind as MessageKind,
        content,
      );

      console.log('Message sent:', msg);

      // Emit the message to all other members of the conversation
      socket.to(`conv:${conversationId}`).emit('message:new', msg);

      // Acknowledge the sender that the message has been sent
      socket.emit('message:ack', { messageId: msg.id });
    } catch (e) {
      socket.emit('error', {
        code: 'SEND_FAILED',
        message: 'Failed to send message',
      });
    }
  }

  // Handle typing event
  @SubscribeMessage('typing')
  async onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string; on: boolean },
  ) {
    console.log('Hit in onTyping');
    const userId = socket.data.userId as string;

    try {
      // Fetch the user name
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      // Emit the typing event to the conversation
      socket
        .to(`conv:${body.conversationId}`)
        .emit('typing', { userId, userName: user?.name, on: body.on });
    } catch (error) {
      console.error('Failed to fetch user data for typing event:', error);
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
