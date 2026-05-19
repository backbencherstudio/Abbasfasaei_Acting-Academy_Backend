import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import appConfig from '../../config/app.config';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private redisPub: Redis;
  private redisSub: Redis;
  private clients = new Map<string, string>(); // userId → socketId

  onModuleInit() {
    const redisOpts = {
      host: appConfig().redis.host,
      port: Number(appConfig().redis.port),
      password: appConfig().redis.password,
    };

    this.redisPub = new Redis(redisOpts);
    this.redisSub = new Redis(redisOpts);

    this.redisSub.subscribe('notification');
    this.redisSub.on('message', (_channel: string, message: string) => {
      if (!message) return;
      const data = JSON.parse(message);
      const receiverId = data.receiver_id || data.userId;
      if (receiverId) {
        const targetSocketId = this.clients.get(receiverId);
        if (targetSocketId) {
          this.server.to(targetSocketId).emit('notification', data);
        }
      } else {
        this.server.emit('notification', data);
      }
    });
  }

  afterInit() {
    console.log('Notification WebSocket server started');
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.clients.set(userId, client.id);
    }
  }

  handleDisconnect(client: Socket) {
    const entry = [...this.clients.entries()].find(
      ([, sid]) => sid === client.id,
    );
    if (entry) this.clients.delete(entry[0]);
  }

  @SubscribeMessage('sendNotification')
  async handleNotification(@MessageBody() data: any) {
    const targetSocketId = this.clients.get(data.userId);
    if (targetSocketId) {
      await this.redisPub.publish('notification', JSON.stringify(data));
    }
  }
}
