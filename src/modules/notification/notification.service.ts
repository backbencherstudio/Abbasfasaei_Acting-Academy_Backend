import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { Prisma } from '@prisma/client';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  // ─── Get All ───────────────────────────────────────────────────────
  async findAll(
    userId: string,
    query?: { page?: string; limit?: string; search?: string },
  ) {
    const page = parseInt(query?.page || '1', 10);
    const limit = parseInt(query?.limit || '10', 10);
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      receiver_id: userId,
    };

    if (query?.search) {
      where.notification_event = {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { content: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, notifications, unread_count] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        select: {
          id: true,
          sender_id: true,
          receiver_id: true,
          entity_id: true,
          read_at: true,
          created_at: true,
          sender: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          receiver: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          notification_event: {
            select: { id: true, type: true, title: true, content: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({
        where: {
          receiver_id: userId,
          read_at: null,
        },
      }),
    ]);

    for (const n of notifications) {
      if (n.sender) this.attachAvatarUrl(n.sender);
      if (n.receiver) this.attachAvatarUrl(n.receiver);
    }

    const total_pages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        notifications,
        unread_count,
        meta: {
          total,
          page,
          limit,
          total_pages,
        },
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

  // ─── Helpers ───────────────────────────────────────────────────────
  private attachAvatarUrl(user: { avatar?: string; [key: string]: any }) {
    if (!user.avatar) return;
    const avatar = String(user.avatar);
    if (/^https?:\/\//i.test(avatar)) {
      user['avatar_url'] = avatar;
    } else {
      const base = appConfig().storageUrl.avatar.replace(/\/+$/, '');
      user['avatar_url'] = NajimStorage.url(
        `${base}/${avatar.replace(/^\/+/, '')}`,
      );
    }
  }
}
