import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import appConfig from 'src/config/app.config';

import { ChatRepository } from 'src/common/repository/chat/chat.repository';

type JwtPayload = {
  sub?: string;
  userId?: string;
};

const conversationIdSchema = z
  .string()
  .trim()
  .min(1, 'conversationId is required')
  .max(100, 'conversationId is too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'conversationId is invalid');

const joinSchema = z.object({
  conversationId: conversationIdSchema,
});

const typingSchema = z.object({
  conversationId: conversationIdSchema,
  on: z.boolean().default(true),
});

const readMessageSchema = z.object({
  conversationId: conversationIdSchema,
  at: z.string().datetime().optional(),
});

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_APP_URL || 'http://127.0.0.1:5500',
    credentials: true,
  },
  namespace: '/ws',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  io: Server;

  private readonly USERNAME_CACHE_TTL_MS = 60_000;
  private readonly TYPING_MIN_INTERVAL_MS = 1500;

  private onlineUsers = new Map<string, Set<string>>();
  private usernameCache = new Map<
    string,
    { name: string | null; ts: number }
  >();

  private typingLastEmit = new Map<string, number>();
  private redisSub: Redis;

  onModuleInit() {
    const redisOpts = {
      host: appConfig().redis.host,
      port: Number(appConfig().redis.port),
      password: appConfig().redis.password,
    };

    this.redisSub = new Redis(redisOpts);
    this.redisSub.subscribe('chat:messages');
    this.redisSub.on('message', (channel: string, message: string) => {
      if (channel === 'chat:messages' && message) {
        try {
          const data = JSON.parse(message);
          this.io
            .to(`conv:${data.conversation_id}`)
            .emit('message:new', data.msg);
        } catch (err) {
          this.dbg('redis_sub_message_parse_failed', {
            error: (err as Error).message,
          });
        }
      }
    });
  }

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(socket: Socket) {
    try {
      const token = this.getToken(socket);

      if (!token) {
        throw new Error('No token');
      }

      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET,
      }) as JwtPayload;

      const userId = payload.sub || payload.userId;

      if (!userId) {
        throw new Error('Invalid token payload');
      }

      const userExists = await ChatRepository.userExists(userId);

      if (!userExists) {
        this.dbg('user_not_found', { userId });

        socket.emit('connection:error', {
          code: 'UNAUTHORIZED',
          message: 'Your session is no longer valid. Please log in again.',
        });

        socket.disconnect(true);
        return;
      }

      socket.data.userId = userId;
      socket.join(`user:${userId}`);

      const wasOffline = this.addUserSocket(userId, socket.id);

      if (wasOffline) {
        await ChatRepository.updateLastActive(userId, null);

        await this.notifyPresenceToRelatedUsers(userId, true);
      }

      socket.emit('connection:ok', { user_id: userId });

      this.dbg('connection', {
        sid: socket.id,
        userId,
        wasOffline,
      });
    } catch (err) {
      this.dbg('connection_failed', {
        sid: socket.id,
        error: (err as Error)?.message,
      });

      socket.emit('connection:error', {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      });

      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string | undefined;

    if (!userId) {
      return;
    }

    const isNowOffline = this.removeUserSocket(userId, socket.id);

    if (!isNowOffline) {
      this.dbg('disconnect_keep_online', {
        sid: socket.id,
        userId,
      });

      return;
    }

    try {
      await ChatRepository.updateLastActive(userId, new Date());
    } catch (_) {
      // User may have been deleted while socket was connected.
    }

    this.usernameCache.delete(userId);
    for (const key of this.typingLastEmit.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.typingLastEmit.delete(key);
      }
    }

    await this.notifyPresenceToRelatedUsers(userId, false);

    this.dbg('disconnect_offline', {
      sid: socket.id,
      userId,
    });
  }

  @SubscribeMessage('conversation:join')
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ) {
    const userId = socket.data.userId as string | undefined;

    if (!userId) {
      return;
    }

    const parsed = joinSchema.safeParse(body);

    if (!parsed.success) {
      socket.emit('error:conversation', {
        code: 'BAD_REQUEST',
        message: 'conversationId required',
      });

      return;
    }

    const { conversationId } = parsed.data;

    try {
      await ChatRepository.ensureMember(conversationId, userId);

      socket.join(`conv:${conversationId}`);

      socket.emit('conversation:joined', {
        conversation_id: conversationId,
      });

      this.dbg('conversation_joined', {
        userId,
        conversationId,
      });
    } catch (err) {
      this.dbg('conversation_join_failed', {
        userId,
        conversationId,
        error: (err as Error)?.message,
      });

      socket.emit('error:conversation', {
        code: 'JOIN_FAILED',
        message: 'Not a member of conversation',
      });
    }
  }

  @SubscribeMessage('typing')
  async onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ) {
    const userId = socket.data.userId as string | undefined;

    if (!userId) {
      return;
    }

    const parsed = typingSchema.safeParse(body);

    if (!parsed.success) {
      return;
    }

    const { conversationId, on } = parsed.data;

    const key = `${userId}:${conversationId}`;
    const now = Date.now();
    const lastEmit = this.typingLastEmit.get(key) || 0;

    if (now - lastEmit < this.TYPING_MIN_INTERVAL_MS) {
      return;
    }

    this.typingLastEmit.set(key, now);

    try {
      await ChatRepository.ensureMember(conversationId, userId);

      const userName = await this.getUserName(userId);

      socket.to(`conv:${conversationId}`).emit('typing', {
        conversation_id: conversationId,
        user_id: userId,
        user_name: userName,
        on,
      });
    } catch (_) {
      // Typing event is best-effort, so no client error is needed.
    }
  }

  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ) {
    const userId = socket.data.userId as string | undefined;

    if (!userId) {
      return;
    }

    const parsed = readMessageSchema.safeParse(body);

    if (!parsed.success) {
      socket.emit('error:message', {
        code: 'BAD_READ_PAYLOAD',
        message: 'Invalid read payload',
      });

      return;
    }

    const { conversationId, at } = parsed.data;
    const readAt = at ? new Date(at) : new Date();

    try {
      await ChatRepository.ensureMember(conversationId, userId);

      // TODO: update markAsRead call according to conversationsService new signature
      // await this.conversationsService.markAsRead(conversationId, userId, { up_to_message_id: 'some-id' });

      this.io.to(`conv:${conversationId}`).emit('message:read', {
        conversation_id: conversationId,
        user_id: userId,
        at: readAt.toISOString(),
      });
    } catch (err) {
      this.dbg('message_read_failed', {
        userId,
        conversationId,
        error: (err as Error)?.message,
      });

      socket.emit('error:message', {
        code: 'READ_FAILED',
        message: 'Failed to update read status',
      });
    }
  }

  emitCallIncoming(
    conversationId: string,
    fromUserId: string,
    kind: 'AUDIO' | 'VIDEO',
    toUserIds: string[],
  ) {
    const payload = {
      conversation_id: conversationId,
      from_user_id: fromUserId,
      kind,
      at: new Date().toISOString(),
    };

    for (const userId of toUserIds) {
      this.io.to(`user:${userId}`).emit('call:incoming', payload);
    }
  }

  emitCallEnded(conversationId: string, byUserId: string, toUserIds: string[]) {
    const payload = {
      conversation_id: conversationId,
      by_user_id: byUserId,
      at: new Date().toISOString(),
    };

    for (const userId of toUserIds) {
      this.io.to(`user:${userId}`).emit('call:ended', payload);
    }
  }

  private getToken(socket: Socket): string | undefined {
    const authToken = socket.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = socket.handshake.headers.authorization;

    if (typeof authorization !== 'string') {
      return undefined;
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      return undefined;
    }

    return token.trim();
  }

  private addUserSocket(userId: string, socketId: string): boolean {
    const sockets = this.onlineUsers.get(userId) || new Set<string>();
    const wasOffline = sockets.size === 0;

    sockets.add(socketId);
    this.onlineUsers.set(userId, sockets);

    return wasOffline;
  }

  private removeUserSocket(userId: string, socketId: string): boolean {
    const sockets = this.onlineUsers.get(userId);

    if (!sockets) {
      return true;
    }

    sockets.delete(socketId);

    if (sockets.size > 0) {
      this.onlineUsers.set(userId, sockets);
      return false;
    }

    this.onlineUsers.delete(userId);
    return true;
  }

  private async notifyPresenceToRelatedUsers(userId: string, online: boolean) {
    const relatedUserIds = await ChatRepository.getRelatedUserIds(userId);
    if (relatedUserIds.length === 0) return;

    const rooms = relatedUserIds.map(
      (relatedUserId) => `user:${relatedUserId}`,
    );

    this.io.to(rooms).emit('presence:update', {
      user_id: userId,
      online,
    });
  }

  private async getUserName(userId: string): Promise<string | null> {
    const now = Date.now();
    const cached = this.usernameCache.get(userId);

    if (cached && now - cached.ts <= this.USERNAME_CACHE_TTL_MS) {
      return cached.name;
    }

    const name = await ChatRepository.getUserName(userId);

    this.usernameCache.set(userId, {
      name,
      ts: now,
    });

    return name;
  }

  private dbg(...args: unknown[]) {
    if (process.env.CHAT_DEBUG !== '1') {
      return;
    }

    console.log('[Realtime]', ...args);
  }
}
