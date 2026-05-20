// src/messages/messages.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, MessageKind, ConversationType } from '@prisma/client';
import { ConversationsService } from '../conversations/conversations.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { StringHelper } from 'src/common/helper/string.helper';
import { CursorPaginationDto } from './dto/query-message.dto';
import { SendMessageDto } from '../conversations/dto/create-conversation.dto';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private conv: ConversationsService,
    private users: UsersService,
  ) {}

  // private resolveAvatarUrl(avatar?: string | null) {
  //   if (!avatar) return null;
  //   if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
  //     return avatar;
  //   }
  //   const base = appConfig().storageUrl.avatar.replace(/\/+$/, '');
  //   const name = avatar.replace(/^\/+/, '');
  //   return NajimStorage.url(`${base}/${name}`);
  // }

  // /**
  //  * List messages in a conversation with cursor pagination.
  //  * Respects per-user "clearedAt" (clear chat for me) and global soft-deletes.
  //  */
  async getConversationMessages(
    conversation_id: string,
    user_id: string,
    query: CursorPaginationDto,
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first');
    if (!conversation_id)
      throw new BadRequestException('Invalid conversation id');

    const membership = await this.prisma.membership.findFirst({
      where: {
        conversation_id: conversation_id,
        user_id: user_id,
      },
      select: { id: true, cleared_at: true },
    });

    if (!membership) throw new NotFoundException('Conversation not found');
    const { cursor, limit } = query;

    const messages = await this.prisma.message.findMany({
      where: {
        AND: [
          { conversation_id },
          { deleted_at: null },
          { created_at: { gt: membership.cleared_at } },
          {
            OR: [
              {
                receipts: {
                  some: {
                    user_id: user_id,
                  },
                },
              },
              {
                sender_id: user_id,
              },
            ],
          },
        ],
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
        created_at: true,
        deleted_at: true,
        sender: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    return {
      success: true,
      message: 'Message fetched successfully',
      data: messages.map((m) => {
        const { sender, attachments } = m;
        return {
          ...m,
          attachments: attachments.map((attachment) => {
            return {
              ...attachment,
              file_path: attachment?.file_path
                ? NajimStorage.url(attachment?.file_path)
                : null,
            };
          }),
          sender: {
            ...sender,
            avatar: sender?.avatar ? NajimStorage.url(sender?.avatar) : null,
          },
        };
      }),
    };
  }

  async sendMessage(
    conversation_id: string,
    user_id: string,
    sendMessageDto: SendMessageDto,
    attachments?: Express.Multer.File[],
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first');
    if (!conversation_id)
      throw new BadRequestException('Invalid conversation id');

    const membership = await this.prisma.membership.findFirst({
      where: {
        conversation_id: conversation_id,
        user_id: user_id,
      },
      select: {
        id: true,
        conversation: { select: { type: true } },
      },
    });

    if (!membership) throw new NotFoundException('Conversation not found');

    // Block checks only apply to DM conversations
    if (membership.conversation.type === 'DM') {
      const otherMember = await this.prisma.membership.findFirst({
        where: {
          conversation_id: conversation_id,
          user_id: { not: user_id },
        },
        select: { user_id: true },
      });

      if (otherMember) {
        const blockedByOther = await this.prisma.block.findFirst({
          where: {
            blocker_id: otherMember.user_id,
            blocked_id: user_id,
          },
        });
        if (blockedByOther)
          throw new BadRequestException('You have been blocked by this user');

        const blockedByMe = await this.prisma.block.findFirst({
          where: {
            blocker_id: user_id,
            blocked_id: otherMember.user_id,
          },
        });
        if (blockedByMe)
          throw new BadRequestException(
            'You have blocked this user. Unblock to send messages',
          );
      }
    }

    const { content, kind, reply_to_id } = sendMessageDto;

    // Validate reply_to_id if provided
    if (reply_to_id) {
      const replyMessage = await this.prisma.message.findFirst({
        where: {
          id: reply_to_id,
          conversation_id: conversation_id,
          deleted_at: null,
        },
        select: { id: true },
      });
      if (!replyMessage) {
        throw new BadRequestException(
          'Reply message not found in this conversation',
        );
      }
    }

    const attachmentData: Prisma.AttachmentCreateInput[] = [];

    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        try {
          const filename = NajimStorage.generateFileName(
            attachment.originalname,
          );
          const objectKey =
            appConfig().storageUrl.message_attachments + '/' + filename;
          await NajimStorage.put(objectKey, attachment.buffer);

          let type: 'IMAGE' | 'VIDEO' | 'FILE' = 'FILE';
          if (attachment.mimetype?.startsWith('image/')) {
            type = 'IMAGE';
          } else if (attachment.mimetype?.startsWith('video/')) {
            type = 'VIDEO';
          }

          attachmentData.push({
            file_name: attachment.originalname,
            file_path: objectKey,
            mime_type: attachment.mimetype,
            type,
            size_bytes: attachment.size,
          });
        } catch (error) {
          console.log('Error uploading attachment:', error);
        }
      }
    }

    if (!content && attachmentData.length < 1) {
      throw new BadRequestException('Message content is required');
    }

    await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversation_id,
          sender_id: user_id,
          kind: kind || 'TEXT',
          content,
          ...(reply_to_id && { reply_to_id }),
          attachments: { create: attachmentData },
        },
      });

      // Create SENT receipts for unblocked, active members (excluding sender)
      const members = await tx.membership.findMany({
        where: {
          conversation_id,
          user_id: { not: user_id },
          left_at: null,
          user: {
            blocks_initiated: { none: { blocked_id: user_id } },
            blocked_by: { none: { blocker_id: user_id } },
          },
        },
        select: { user_id: true },
      });

      if (members.length > 0) {
        await tx.receipt.createMany({
          data: members.map((m) => ({
            message_id: msg.id,
            user_id: m.user_id,
            status: 'SENT' as const,
          })),
        });
      }
    });

    return {
      success: true,
      message: 'Message sent successfully',
    };
  }

  // // mark messages as read up to "at" timestamp (or now if not provided)
  // async markRead(conversationId: string, userId: string, at?: Date) {
  //   const me = await this.prisma.membership.findFirst({
  //     where: { conversationId, userId },
  //     select: { clearedAt: true },
  //   });
  //   const floor = me?.clearedAt ?? new Date(0);

  //   await this.prisma.message.updateMany({
  //     where: {
  //       conversationId,
  //       senderId: { not: userId },
  //       createdAt: { gt: floor },
  //       ...(at ? { createdAt: { lte: at } } : {}),
  //     },
  //     data: { readAt: new Date() },
  //   });
  // }

  // /**
  //  * Shared helper for Media/Files tabs with clearedAt + cursor pagination.
  //  */
  // private validateListInputs(
  //   conversationId: string,
  //   userId: string,
  //   take: number,
  // ) {
  //   const normalizedConversationId = String(conversationId ?? '').trim();
  //   const normalizedUserId = String(userId ?? '').trim();

  //   if (!normalizedConversationId) {
  //     throw new BadRequestException('conversationId is required');
  //   }

  //   if (!normalizedUserId) {
  //     throw new BadRequestException('userId is required');
  //   }

  //   const requestedTake = Number(take);
  //   if (!Number.isInteger(requestedTake) || requestedTake < 1) {
  //     throw new BadRequestException('take must be a positive integer');
  //   }

  //   const safeTake = Math.min(requestedTake, 100);

  //   return {
  //     conversationId: normalizedConversationId,
  //     userId: normalizedUserId,
  //     take: safeTake,
  //   };
  // }

  // private async listByKinds(
  //   conversationId: string,
  //   userId: string,
  //   kinds: MessageKind[],
  //   cursor?: string,
  //   take = 20,
  // ) {
  //   if (!Array.isArray(kinds) || kinds.length === 0) {
  //     throw new BadRequestException('kinds must contain at least one item');
  //   }

  //   const validated = this.validateListInputs(conversationId, userId, take);

  //   await this.conv.ensureMember(validated.conversationId, validated.userId);

  //   const me = await this.prisma.membership.findFirst({
  //     where: {
  //       conversationId: validated.conversationId,
  //       userId: validated.userId,
  //     },
  //     select: { clearedAt: true },
  //   });
  //   const floor = me?.clearedAt ?? new Date(0);

  //   const normalizedCursor = String(cursor ?? '').trim();
  //   if (normalizedCursor) {
  //     const cursorMessage = await this.prisma.message.findUnique({
  //       where: { id: normalizedCursor },
  //       select: {
  //         id: true,
  //         conversationId: true,
  //         kind: true,
  //         deletedAt: true,
  //         createdAt: true,
  //       },
  //     });

  //     if (!cursorMessage) {
  //       throw new BadRequestException('Invalid cursor: message not found');
  //     }

  //     if (cursorMessage.conversationId !== validated.conversationId) {
  //       throw new BadRequestException(
  //         'Invalid cursor: message belongs to a different conversation',
  //       );
  //     }

  //     if (cursorMessage.deletedAt) {
  //       throw new BadRequestException('Invalid cursor: message is deleted');
  //     }

  //     if (!kinds.includes(cursorMessage.kind)) {
  //       throw new BadRequestException(
  //         `Invalid cursor: message kind must be one of ${kinds.join(', ')}`,
  //       );
  //     }

  //     if (cursorMessage.createdAt <= floor) {
  //       throw new BadRequestException(
  //         'Invalid cursor: message is outside your visible range',
  //       );
  //     }
  //   }

  //   const items = await this.prisma.message.findMany({
  //     where: {
  //       conversationId: validated.conversationId,
  //       kind: { in: kinds },
  //       deletedAt: null,
  //       createdAt: { gt: floor },
  //     },
  //     orderBy: { createdAt: 'desc' },
  //     take: validated.take,
  //     ...(normalizedCursor
  //       ? { skip: 1, cursor: { id: normalizedCursor } }
  //       : {}),
  //     select: {
  //       id: true,
  //       kind: true, // IMAGE | VIDEO | FILE | AUDIO
  //       content: true, // e.g. { url, name, size, mime }
  //       createdAt: true,
  //       senderId: true,
  //       conversationId: true,
  //       media_Url: true,
  //     },
  //   });

  //   const nextCursor =
  //     items.length === validated.take ? items[items.length - 1].id : null;
  //   return { items, nextCursor };
  // }

  // /** Images & Videos */
  // listMedia(
  //   conversationId: string,
  //   userId: string,
  //   cursor?: string,
  //   take = 20,
  // ) {
  //   return this.listByKinds(
  //     conversationId,
  //     userId,
  //     ['IMAGE', 'VIDEO'],
  //     cursor,
  //     take,
  //   );
  // }

  // /** Files (docs, pdfs, etc.) */
  // listFiles(
  //   conversationId: string,
  //   userId: string,
  //   cursor?: string,
  //   take = 20,
  // ) {
  //   return this.listByKinds(conversationId, userId, ['FILE'], cursor, take);
  // }

  // /**
  //  * Search text messages (ILIKE on content->>'text').
  //  * Respects clearedAt and soft-deletes.
  //  */
  // private validateSearchInputs(
  //   userId: string,
  //   q: string,
  //   conversationId?: string,
  //   take = 20,
  //   skip = 0,
  // ) {
  //   const normalizedUserId = String(userId ?? '').trim();
  //   if (!normalizedUserId) {
  //     throw new BadRequestException('userId is required');
  //   }

  //   const normalizedQuery = String(q ?? '').trim();
  //   if (!normalizedQuery) {
  //     throw new BadRequestException('q is required');
  //   }

  //   if (normalizedQuery.length < 2) {
  //     throw new BadRequestException('q must be at least 2 characters');
  //   }

  //   const normalizedConversationId = String(conversationId ?? '').trim();

  //   const parsedTake = Number(take);
  //   if (!Number.isInteger(parsedTake) || parsedTake < 1) {
  //     throw new BadRequestException('take must be a positive integer');
  //   }

  //   const parsedSkip = Number(skip);
  //   if (!Number.isInteger(parsedSkip) || parsedSkip < 0) {
  //     throw new BadRequestException('skip must be a non-negative integer');
  //   }

  //   return {
  //     userId: normalizedUserId,
  //     q: normalizedQuery,
  //     conversationId: normalizedConversationId || undefined,
  //     take: Math.min(parsedTake, 100),
  //     skip: parsedSkip,
  //   };
  // }

  // async search(
  //   userId: string,
  //   q: string,
  //   conversationId?: string,
  //   take = 20,
  //   skip = 0,
  // ) {
  //   const validated = this.validateSearchInputs(
  //     userId,
  //     q,
  //     conversationId,
  //     take,
  //     skip,
  //   );

  //   const safeTake = validated.take;
  //   const safeSkip = validated.skip;

  //   // If a single conversation search, verify membership & floor
  //   if (validated.conversationId) {
  //     // Single-conversation search: membership + per-user floor (clearedAt)
  //     await this.conv.ensureMember(validated.conversationId, validated.userId);
  //     const cleared = await this.prisma.membership.findFirst({
  //       where: {
  //         conversationId: validated.conversationId,
  //         userId: validated.userId,
  //       },
  //       select: { clearedAt: true },
  //     });
  //     const floor = cleared?.clearedAt ?? new Date(0);
  //     // IMPORTANT: Prisma model Message is mapped to physical table "messages" (see @@map in schema)
  //     return this.prisma.$queryRaw<any[]>`
  //       SELECT id, kind, content, message,
  //              "created_at" AS "createdAt",
  //              "sender_id" AS "senderId",
  //              "conversation_id" AS "conversationId",
  //              "media_url" AS "media_Url"
  //       FROM "messages"
  //       WHERE kind = 'TEXT'
  //         AND "conversation_id" = ${validated.conversationId}
  //         AND "created_at" > ${floor}
  //         AND "deleted_at" IS NULL
  //         AND (
  //           COALESCE(content->>'text', '') ILIKE '%' || ${validated.q} || '%'
  //           OR COALESCE(message, '') ILIKE '%' || ${validated.q} || '%'
  //         )
  //       ORDER BY "created_at" DESC
  //       LIMIT ${safeTake} OFFSET ${safeSkip}
  //     `;
  //   }

  //   // Multi-conversation search: restrict to user's memberships
  //   const memberConvIds = await this.prisma.membership.findMany({
  //     where: { userId: validated.userId },
  //     select: { conversationId: true, clearedAt: true },
  //   });
  //   if (memberConvIds.length === 0) return [];

  //   // Build temporary table of floors
  //   const convIds = memberConvIds.map((m) => m.conversationId);
  //   const floors: Record<string, Date> = {};
  //   memberConvIds.forEach(
  //     (m) => (floors[m.conversationId] = m.clearedAt ?? new Date(0)),
  //   );

  //   // Raw query limited to membership conversations; apply floor in post-filter (simpler & portable)
  //   // Build an IN clause safely. Using Prisma.sql join ensures proper parameterization.
  //   const inList = Prisma.join(convIds.map((id) => Prisma.sql`${id}`));
  //   const rows = await this.prisma.$queryRaw<any[]>`
  //     SELECT id, kind, content, message,
  //            "created_at" AS "createdAt",
  //            "sender_id" AS "senderId",
  //            "conversation_id" AS "conversationId",
  //            "media_url" AS "media_Url"
  //     FROM "messages"
  //     WHERE kind = 'TEXT'
  //       AND "conversation_id" IN (${inList})
  //       AND "deleted_at" IS NULL
  //       AND (
  //         COALESCE(content->>'text', '') ILIKE '%' || ${validated.q} || '%'
  //         OR COALESCE(message, '') ILIKE '%' || ${validated.q} || '%'
  //       )
  //     ORDER BY "created_at" DESC
  //     LIMIT ${safeTake} OFFSET ${safeSkip}
  //   `;

  //   return rows.filter((r) => r.createdAt > floors[r.conversationId]);
  // }

  // /**
  //  * Soft-delete a message.
  //  * Sender can delete their own message; group ADMIN can delete any message in that group.
  //  */
  // async deleteMessage(messageId: string, byUserId: string) {
  //   const msg = await this.prisma.message.findUnique({
  //     where: { id: messageId },
  //     select: { id: true, senderId: true, conversationId: true },
  //   });
  //   if (!msg) return { ok: true }; // idempotent

  //   // allow sender OR group admin
  //   if (msg.senderId !== byUserId) {
  //     const m = await this.prisma.membership.findFirst({
  //       where: { conversationId: msg.conversationId, userId: byUserId },
  //       select: { role: true },
  //     });
  //     if (!m || m.role !== 'ADMIN') throw new ForbiddenException('Not allowed');
  //   }

  //   await this.prisma.message.update({
  //     where: { id: messageId },
  //     data: { deletedAt: new Date(), deletedById: byUserId, content: {} },
  //   });
  //   return { ok: true };
  // }

  // /**
  //  * Report a message with an optional reason.
  //  */
  // async reportMessage(messageId: string, byUserId: string, reason?: string) {
  //   const msg = await this.prisma.message.findUnique({
  //     where: { id: messageId },
  //     select: { id: true, conversationId: true },
  //   });
  //   if (!msg) throw new NotFoundException('Message not found');

  //   await this.conv.ensureMember(msg.conversationId, byUserId);

  //   const report = await this.prisma.report.create({
  //     data: {
  //       messageId: messageId,
  //       reporterId: byUserId,
  //       reason: reason?.trim()?.slice(0, 500) || 'Reported by user',
  //     },
  //     select: { id: true, status: true, createdAt: true },
  //   });
  //   return { ok: true, report };
  // }
}
