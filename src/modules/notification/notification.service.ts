import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { QueryNotificationDto } from './dto/query-notification.dto';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  // ─── Get All ───────────────────────────────────────────────────────
  async findAll(userId: string, query: QueryNotificationDto) {
    const { cursor, limit, search, type } = query;

    const where: Prisma.NotificationWhereInput = {
      receiver_id: userId,
    };

    if (type) {
      where.notification_event = {
        type,
      };
    }

    if (search) {
      where.notification_event = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { type: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, notifications, unread_count] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        select: {
          id: true,
          created_at: true,
          read_at: true,
          notification_event: {
            select: {
              id: true,
              title: true,
              content: true,
              type: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : undefined,
      }),
      this.prisma.notification.count({
        where: {
          receiver_id: userId,
          read_at: null,
        },
      }),
    ]);

    const nextCursor =
      notifications.length > limit
        ? notifications[notifications.length - 1].id
        : null;

    if (nextCursor) {
      notifications.pop();
    }

    return {
      success: true,
      data: notifications.map((n) => ({
        id: n?.id,
        title: n?.notification_event?.title,
        content: n?.notification_event?.content,
        type: n?.notification_event?.type,
        created_at: n?.created_at,
        read_at: n?.read_at,
        is_read: n?.read_at !== null,
      })),
      meta_data: {
        unread_count,
        next_cursor: nextCursor,
        total,
        limit,
        search,
        type,
      },
    };
  }

  // ─── Mark Read ─────────────────────────────────────────────────────
  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.receiver_id && notification.receiver_id !== userId) {
      throw new ForbiddenException();
    }

    await this.prisma.notification.update({
      where: { id },
      data: { read_at: new Date() },
    });

    return { success: true, message: 'Notification marked as read' };
  }

  // ─── Mark All Read ─────────────────────────────────────────────────
  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: {
        receiver_id: userId,
        read_at: null,
      },
      data: { read_at: new Date() },
    });

    return {
      success: true,
      message: `${count} notification(s) marked as read`,
    };
  }

  // ─── Remove ────────────────────────────────────────────────────────
  async remove(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.receiver_id && notification.receiver_id !== userId) {
      throw new ForbiddenException();
    }

    await this.prisma.notification.delete({ where: { id } });
    return { success: true, message: 'Notification deleted successfully' };
  }

  // ─── Remove All ────────────────────────────────────────────────────
  async removeAll(userId: string) {
    const { count } = await this.prisma.notification.deleteMany({
      where: { receiver_id: userId },
    });

    return {
      success: true,
      message: `${count} notification(s) deleted successfully`,
    };
  }
}
