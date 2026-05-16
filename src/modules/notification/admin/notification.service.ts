import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { UserRepository } from 'src/common/repository/user/user.repository';
import { Role } from 'src/common/guard/role/role.enum';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async findAll(user_id: string) {
    try {
      const where_condition = {};
      const userDetails = await UserRepository.getUserDetails(user_id);
      const attachedRoles = (userDetails?.role_users || []).map((r) =>
        String(r?.role?.name || '').toLowerCase(),
      );
      const isAdmin = attachedRoles.includes('admin') || attachedRoles.includes('su_admin');

      if (isAdmin) {
        where_condition['OR'] = [
          { receiver_id: { equals: user_id } },
          { receiver_id: { equals: null } },
        ];
      }
      // else if (userDetails.type == Role.VENDOR) {
      //   where_condition['receiver_id'] = user_id;
      // }

      const notifications = await this.prisma.notification.findMany({
        where: {
          ...where_condition,
        },
        select: {
          id: true,
          sender_id: true,
          receiver_id: true,
          entity_id: true,
          created_at: true,
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          notification_event: {
            select: {
              id: true,
              type: true,
              text: true,
            },
          },
        },
      });

      // add url to avatar
      if (notifications.length > 0) {
        for (const notification of notifications) {
          if (notification.sender && notification.sender.avatar) {
            const sAvatar = String(notification.sender.avatar);
            if (/^https?:\/\//i.test(sAvatar)) {
              notification.sender['avatar_url'] = sAvatar;
            } else {
              const base = appConfig().storageUrl.avatar.replace(/\/+$/, '');
              notification.sender['avatar_url'] = NajimStorage.url(`${base}/${sAvatar.replace(/^\/+/, '')}`);
            }
          }

          if (notification.receiver && notification.receiver.avatar) {
            const rAvatar = String(notification.receiver.avatar);
            if (/^https?:\/\//i.test(rAvatar)) {
              notification.receiver['avatar_url'] = rAvatar;
            } else {
              const base = appConfig().storageUrl.avatar.replace(/\/+$/, '');
              notification.receiver['avatar_url'] = NajimStorage.url(`${base}/${rAvatar.replace(/^\/+/, '')}`);
            }
          }
        }
      }

      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string, user_id: string) {
    try {
      // check if notification exists
      const notification = await this.prisma.notification.findUnique({
        where: {
          id: id,
          // receiver_id: user_id,
        },
      });

      if (!notification) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      await this.prisma.notification.delete({
        where: {
          id: id,
        },
      });

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async removeAll(user_id: string) {
    try {
      // check if notification exists
      const notifications = await this.prisma.notification.findMany({
        where: {
          OR: [{ receiver_id: user_id }, { receiver_id: null }],
        },
      });

      if (notifications.length == 0) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      await this.prisma.notification.deleteMany({
        where: {
          OR: [{ receiver_id: user_id }, { receiver_id: null }],
        },
      });

      return {
        success: true,
        message: 'All notifications deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
