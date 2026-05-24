import { PrismaClient } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import Redis from 'ioredis';
import appConfig from 'src/config/app.config';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';

/**
 * Standalone PrismaClient for ChatRepository's static methods.
 * Cannot use NestJS-managed PrismaService because this is a static class
 * outside the DI container. Maintains its own connection pool.
 */
const prisma = new PrismaClient();
const redisPublisher = new Redis({
  host: appConfig().redis.host,
  port: Number(appConfig().redis.port),
  password: appConfig().redis.password,
});

export class ChatRepository {
  static onlineUsers = new Set<string>();

  static async userExists(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return !!user;
  }

  static async updateLastActive(
    userId: string,
    lastActiveAt: Date | null,
  ): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId },
      data: { last_active_at: lastActiveAt },
    });
  }

  static async getRelatedUserIds(userId: string): Promise<string[]> {
    const conversations = await prisma.conversation.findMany({
      where: {
        memberships: {
          some: {
            user_id: userId,
            left_at: null,
          },
        },
      },
      select: {
        memberships: {
          where: {
            left_at: null,
            user: {
              blocks_initiated: { none: { blocked_id: userId } },
              blocked_by: { none: { blocker_id: userId } },
            },
          },
          select: {
            user_id: true,
          },
        },
      },
    });

    const relatedUserIds = new Set<string>();

    for (const conversation of conversations) {
      for (const membership of conversation.memberships) {
        if (membership.user_id !== userId) {
          relatedUserIds.add(membership.user_id);
        }
      }
    }

    return Array.from(relatedUserIds);
  }

  static async getUserName(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user?.name ?? null;
  }

  static async ensureMember(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const membership = await prisma.membership.findFirst({
      where: {
        conversation_id: conversationId,
        user_id: userId,
        left_at: null,
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this conversation');
    }
    return true;
  }

  static async getMembership(conversationId: string, userId: string) {
    return prisma.membership.findFirst({
      where: {
        conversation_id: conversationId,
        user_id: userId,
        left_at: null,
      },
      select: {
        id: true,
        cleared_at: true,
        role: true,
        conversation: { select: { type: true } },
      },
    });
  }

  static async getMembershipIncludingLeft(
    conversationId: string,
    userId: string,
  ) {
    return prisma.membership.findFirst({
      where: {
        conversation_id: conversationId,
        user_id: userId,
      },
      select: {
        id: true,
        cleared_at: true,
        left_at: true,
        role: true,
        conversation: { select: { type: true } },
      },
    });
  }

  static async getOtherMemberInDm(
    conversationId: string,
    currentUserId: string,
  ) {
    return prisma.membership.findFirst({
      where: {
        conversation_id: conversationId,
        user_id: { not: currentUserId },
        left_at: null,
      },
      select: { user_id: true },
    });
  }

  static async checkBlockStatus(
    blockerId: string,
    blockedId: string,
  ): Promise<boolean> {
    const block = await prisma.block.findFirst({
      where: {
        blocker_id: blockerId,
        blocked_id: blockedId,
      },
      select: { id: true },
    });
    return !!block;
  }

  static async getOneToOneConversation(user1Id: string, user2Id: string) {
    return prisma.conversation.findFirst({
      where: {
        type: 'DM',
        AND: [
          { memberships: { some: { user_id: user1Id } } },
          { memberships: { some: { user_id: user2Id } } },
        ],
      },
      select: { id: true },
    });
  }

  static async getConversationType(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    });
    return conversation?.type ?? null;
  }

  static async sendMessage(
    conversationId: string,
    senderId: string,
    data: {
      content: any;
      kind: any;
      replyToId?: string;
    },
    attachmentData: any[] = [],
  ) {
    const membership = await this.getMembershipIncludingLeft(
      conversationId,
      senderId,
    );
    if (!membership) {
      throw new ForbiddenException('Conversation not found');
    }

    if (membership.left_at) {
      throw new ForbiddenException('You are no longer a member of this conversation');
    }

    if (membership.conversation?.type === 'DM') {
      const otherMember = await this.getOtherMemberInDm(
        conversationId,
        senderId,
      );
      if (otherMember) {
        const blockedByOther = await this.checkBlockStatus(
          otherMember.user_id,
          senderId,
        );
        if (blockedByOther) {
          throw new ForbiddenException('You have been blocked by this user');
        }

        const blockedByMe = await this.checkBlockStatus(
          senderId,
          otherMember.user_id,
        );
        if (blockedByMe) {
          throw new ForbiddenException(
            'You have blocked this user. Unblock to send messages',
          );
        }
      }
    }

    if (data.replyToId) {
      const replyMessage = await prisma.message.findFirst({
        where: {
          id: data.replyToId,
          conversation_id: conversationId,
          deleted_at: null,
        },
        select: { id: true },
      });
      if (!replyMessage) {
        throw new ForbiddenException(
          'Reply message not found in this conversation',
        );
      }
    }

    let createdMessage: any = null;
    let sentMembers: any[] = [];
    await prisma.$transaction(async (tx) => {
      createdMessage = await tx.message.create({
        data: {
          conversation_id: conversationId,
          sender_id: senderId,
          kind: data.kind || 'TEXT',
          content: data.content,
          reply_to_id: data.replyToId,
          attachments: { create: attachmentData },
        },
        select: {
          id: true,
          conversation_id: true,
          kind: true,
          content: true,
          attachments: {
            select: {
              file_name: true,
              file_path: true,
              mime_type: true,
              type: true,
            },
            orderBy: { created_at: 'asc' },
          },
          reply_to: {
            select: {
              id: true,
              content: true,
              kind: true,
              sender_id: true,
              sender: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
              attachments: {
                select: {
                  type: true,
                  file_path: true,
                  file_name: true,
                  mime_type: true,
                },
              },
            },
          },
          created_at: true,
          deleted_at: true,
          sender: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });

      const members = await tx.membership.findMany({
        where: {
          conversation_id: conversationId,
          user_id: { not: senderId },
          left_at: null,
          user: {
            blocks_initiated: { none: { blocked_id: senderId } },
            blocked_by: { none: { blocker_id: senderId } },
          },
        },
        select: { user_id: true },
      });
      sentMembers = members;

      if (members.length > 0) {
        await tx.receipt.createMany({
          data: members.map((m) => ({
            message_id: createdMessage.id,
            user_id: m.user_id,
            status: ChatRepository.onlineUsers.has(m.user_id) ? 'DELIVERED' : 'SENT',
          })),
        });
      }
    });

    if (createdMessage) {
      createdMessage.receipts = sentMembers.map((m: any) => ({
        status: ChatRepository.onlineUsers.has(m.user_id) ? 'DELIVERED' : 'SENT',
        user_id: m.user_id,
      }));
    }

    const formattedMessage = this.formatMessage(createdMessage);

    await redisPublisher
      .publish(
        'chat:messages',
        JSON.stringify({
          conversation_id: conversationId,
          msg: formattedMessage,
        }),
      )
      .catch((err) => console.error('Redis chat publish failed:', err));

    return formattedMessage;
  }

  static async markAsRead(
    conversationId: string,
    userId: string,
    upToMessageId: string,
  ) {
    const targetMessage = await prisma.message.findFirst({
      where: {
        id: upToMessageId,
        conversation_id: conversationId,
      },
      select: { created_at: true },
    });

    if (!targetMessage) return null;

    const now = new Date();

    return prisma.$transaction(async (tx) => {
      // 1. Update membership last_read_at
      await tx.membership.updateMany({
        where: {
          conversation_id: conversationId,
          user_id: userId,
          OR: [
            { last_read_at: null },
            { last_read_at: { lt: targetMessage.created_at } },
          ],
        },
        data: {
          last_read_at: targetMessage.created_at,
        },
      });

      // 2. Find pending receipts
      const pendingReceipts = await tx.receipt.findMany({
        where: {
          user_id: userId,
          status: { not: 'READ' },
          message: {
            conversation_id: conversationId,
            sender_id: { not: userId },
            created_at: { lte: targetMessage.created_at },
          },
        },
        select: {
          message_id: true,
        },
      });

      if (pendingReceipts.length === 0) {
        return {
          last_read_at: targetMessage.created_at,
          marked_count: 0,
          message_ids: [],
        };
      }

      const messageIds = pendingReceipts.map((r) => r.message_id);

      // 3. Update receipts status to READ
      await tx.receipt.updateMany({
        where: {
          user_id: userId,
          message_id: { in: messageIds },
        },
        data: {
          status: 'READ',
          at: now,
        },
      });

      // 4. Publish status update to Redis
      await redisPublisher
        .publish(
          'chat:message_status',
          JSON.stringify({
            conversation_id: conversationId,
            user_id: userId,
            status: 'READ',
            message_ids: messageIds,
          }),
        )
        .catch((err) => console.error('Redis status publish failed:', err));

      return {
        last_read_at: targetMessage.created_at,
        marked_count: messageIds.length,
        message_ids: messageIds,
      };
    });
  }

  static async markMessagesAsDelivered(userId: string) {
    const pendingReceipts = await prisma.receipt.findMany({
      where: {
        user_id: userId,
        status: 'SENT',
      },
      select: {
        message_id: true,
        message: {
          select: {
            conversation_id: true,
          },
        },
      },
    });

    if (pendingReceipts.length === 0) return;

    const messageIds = pendingReceipts.map((r) => r.message_id);

    const convGroups = new Map<string, string[]>();
    for (const r of pendingReceipts) {
      const convId = r.message.conversation_id;
      const list = convGroups.get(convId) || [];
      list.push(r.message_id);
      convGroups.set(convId, list);
    }

    await prisma.receipt.updateMany({
      where: {
        user_id: userId,
        message_id: { in: messageIds },
      },
      data: {
        status: 'DELIVERED',
        at: new Date(),
      },
    });

    for (const [conversationId, msgIds] of convGroups.entries()) {
      await redisPublisher
        .publish(
          'chat:message_status',
          JSON.stringify({
            conversation_id: conversationId,
            user_id: userId,
            status: 'DELIVERED',
            message_ids: msgIds,
          }),
        )
        .catch((err) => console.error('Redis status publish failed:', err));
    }
  }

  static async getLatestMessageBefore(
    conversationId: string,
    beforeDate: Date,
    excludeSenderId: string,
  ) {
    return prisma.message.findFirst({
      where: {
        conversation_id: conversationId,
        created_at: { lte: beforeDate },
        sender_id: { not: excludeSenderId },
      },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
  }

  static formatMessage(m: any) {
    if (!m) return null;
    const { sender, attachments, reply_to, receipts, ...rest } = m;

    let status: 'SENT' | 'DELIVERED' | 'READ' = 'SENT';
    if (receipts && receipts.length > 0) {
      const statuses = receipts.map((r: any) => r.status);
      if (statuses.includes('READ')) {
        status = 'READ';
      } else if (statuses.includes('DELIVERED')) {
        status = 'DELIVERED';
      }
    }

    return {
      ...rest,
      status,
      reply_to: reply_to
        ? {
            ...reply_to,
            sender: reply_to.sender
              ? {
                  ...reply_to.sender,
                  avatar: reply_to.sender?.avatar
                    ? NajimStorage.url(reply_to.sender.avatar)
                    : null,
                }
              : null,
            attachments: reply_to.attachments.map((att: any) => ({
              ...att,
              file_path: att?.file_path
                ? NajimStorage.url(att.file_path)
                : null,
            })),
          }
        : null,
      attachments: attachments.map((attachment: any) => ({
        ...attachment,
        file_path: attachment?.file_path
          ? NajimStorage.url(attachment?.file_path)
          : null,
      })),
      sender: {
        ...sender,
        avatar: sender?.avatar ? NajimStorage.url(sender?.avatar) : null,
      },
    };
  }
}
