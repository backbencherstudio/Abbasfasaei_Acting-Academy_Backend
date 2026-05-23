import { PrismaClient } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import Redis from 'ioredis';
import appConfig from 'src/config/app.config';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';

const prisma = new PrismaClient();
const redisPublisher = new Redis({
  host: appConfig().redis.host,
  port: Number(appConfig().redis.port),
  password: appConfig().redis.password,
});

export class ChatRepository {
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

      if (members.length > 0) {
        await tx.receipt.createMany({
          data: members.map((m) => ({
            message_id: createdMessage.id,
            user_id: m.user_id,
            status: 'SENT',
          })),
        });
      }
    });

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

  static formatMessage(m: any) {
    if (!m) return null;
    const { sender, attachments, reply_to } = m;
    return {
      ...m,
      reply_to: reply_to
        ? {
            ...reply_to,
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
