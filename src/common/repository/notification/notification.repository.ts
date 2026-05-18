import { Notification, PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import appConfig from 'src/config/app.config';

const prisma = new PrismaClient();

const redisPublisher = new Redis({
  host: appConfig().redis.host,
  port: Number(appConfig().redis.port),
  password: appConfig().redis.password,
});

export class NotificationRepository {
  /**
   * Create a notification
   * @param sender_id - The ID of the user who fired the event
   * @param receiver_id - The ID of the user to notify
   * @param title - The title of the notification
   * @param content - The content of the notification
   * @param type - The type of the notification
   * @param entity_id - The ID of the entity related to the notification
   * @returns The created notification
   */
  static async createNotification({
    sender_id,
    receiver_id,
    title,
    content,
    type,
    entity_id,
  }: {
    sender_id?: string;
    receiver_id?: string;
    title?: string;
    content?: string;
    type?:
    | 'message'
    | 'comment'
    | 'review'
    | 'booking'
    | 'payment_transaction'
    | 'package'
    | 'blog';
    entity_id?: string;
  }): Promise<Notification> {
    const notificationEventData = {};
    if (type) {
      notificationEventData['type'] = type;
    }
    if (title) {
      notificationEventData['title'] = title;
    }
    if (content) {
      notificationEventData['content'] = content;
    }
    const notificationEvent = await prisma.notificationEvent.create({
      data: {
        type: type,
        title: title,
        content: content,
        ...notificationEventData,
      },
    });

    const notificationData = {};
    if (sender_id) {
      notificationData['sender_id'] = sender_id;
    }
    if (receiver_id) {
      notificationData['receiver_id'] = receiver_id;
    }
    if (entity_id) {
      notificationData['entity_id'] = entity_id;
    }

    const notification = await prisma.notification.create({
      data: {
        notification_event_id: notificationEvent.id,
        ...notificationData,
      },
    });

    redisPublisher.publish('notification', JSON.stringify({
      id: notification.id,
      title: notificationEvent.title,
      content: notificationEvent.content,
      type: notificationEvent.type,
      entity_id: notification.entity_id,
    }));

    return notification;
  }
}
