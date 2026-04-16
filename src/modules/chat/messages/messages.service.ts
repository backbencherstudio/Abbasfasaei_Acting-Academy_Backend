// src/messages/messages.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, MessageKind, ConversationType } from '@prisma/client';
import { ConversationsService } from '../conversations/conversations.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';
import { StringHelper } from 'src/common/helper/string.helper';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private conv: ConversationsService,
    private users: UsersService,
  ) {}

  private resolveAvatarUrl(avatar?: string | null) {
    if (!avatar) return null;
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    const base = appConfig().storageUrl.avatar.replace(/\/+$/, '');
    const name = avatar.replace(/^\/+/, '');
    return SazedStorage.url(`${base}/${name}`);
  }

  /**
   * List messages in a conversation with cursor pagination.
   * Respects per-user "clearedAt" (clear chat for me) and global soft-deletes.
   */
  async list(
    conversationId: string,
    userId: string,
    cursor?: string,
    take = 500,
  ) {
    await this.conv.ensureMember(conversationId, userId);

    const me = await this.prisma.membership.findFirst({
      where: { conversationId, userId },
      select: { clearedAt: true },
    });
    if (!me) throw new ForbiddenException('Not a member of this conversation');

    const floor = me.clearedAt ?? new Date(0);

    const items = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        createdAt: { gt: floor }, // hide everything cleared for THIS user
      },
      orderBy: { createdAt: 'asc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        sender: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    const nextCursor =
      items.length === take ? items[items.length - 1].id : null;

    const normalizedItems = items.map((m) => ({
      ...m,
      senderAvatarUrl: this.resolveAvatarUrl(m.sender?.avatar),
    }));

    return { items: normalizedItems, nextCursor };
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    kind: MessageKind | undefined,
    content: any,
    file?: Express.Multer.File,
    mediaUrl?: string,
  ) {
    await this.conv.ensureMember(conversationId, userId); // Ensuring the user is a member of the conversation

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true, id: true },
    });

    if (!conv) throw new Error('Conversation not found');

    if (file) {
      const safeOriginalName = (file.originalname || 'file')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '');
      const filename = `${StringHelper.randomString(10)}_${safeOriginalName}`;
      const attachmentPrefix = appConfig().storageUrl.attachment.replace(
        /^\/+/,
        '',
      );
      const objectKey = `${attachmentPrefix}/${filename}`;

      await SazedStorage.put(objectKey, file.buffer);

      mediaUrl = `${process.env.AWS_S3_ENDPOINT}/${process.env.AWS_S3_BUCKET}/${objectKey}`;
    }

    // For Direct Messages (DM), respect block list
    if (conv.type === ConversationType.DM) {
      const members = await this.prisma.membership.findMany({
        where: { conversationId },
        select: { userId: true },
      });
      const otherId = members.map((m) => m.userId).find((id) => id !== userId);
      if (otherId && (await this.users.isBlocked(userId, otherId))) {
        throw new ForbiddenException(
          'Cannot send message: one of the users has blocked the other',
        );
      }
    }

    // console.log('Creating message...', {
    //   conversationId,
    //   userId,
    //   kind,
    //   content,
    // });

    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        kind: kind ?? 'TEXT',
        content: content ?? {},
        media_Url: mediaUrl,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // console.log('msg:', msg);

    // Update the last message time for the conversation
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      ...msg,
      senderAvatarUrl: this.resolveAvatarUrl(msg.sender?.avatar),
    };
  }

  // mark messages as read up to "at" timestamp (or now if not provided)
  async markRead(conversationId: string, userId: string, at?: Date) {
    const me = await this.prisma.membership.findFirst({
      where: { conversationId, userId },
      select: { clearedAt: true },
    });
    const floor = me?.clearedAt ?? new Date(0);

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        createdAt: { gt: floor },
        ...(at ? { createdAt: { lte: at } } : {}),
      },
      data: { readAt: new Date() },
    });
  }

  /**
   * Shared helper for Media/Files tabs with clearedAt + cursor pagination.
   */
  private validateListInputs(
    conversationId: string,
    userId: string,
    take: number,
  ) {
    const normalizedConversationId = String(conversationId ?? '').trim();
    const normalizedUserId = String(userId ?? '').trim();

    if (!normalizedConversationId) {
      throw new BadRequestException('conversationId is required');
    }

    if (!normalizedUserId) {
      throw new BadRequestException('userId is required');
    }

    const requestedTake = Number(take);
    if (!Number.isInteger(requestedTake) || requestedTake < 1) {
      throw new BadRequestException('take must be a positive integer');
    }

    const safeTake = Math.min(requestedTake, 100);

    return {
      conversationId: normalizedConversationId,
      userId: normalizedUserId,
      take: safeTake,
    };
  }

  private async listByKinds(
    conversationId: string,
    userId: string,
    kinds: MessageKind[],
    cursor?: string,
    take = 20,
  ) {
    if (!Array.isArray(kinds) || kinds.length === 0) {
      throw new BadRequestException('kinds must contain at least one item');
    }

    const validated = this.validateListInputs(conversationId, userId, take);

    await this.conv.ensureMember(validated.conversationId, validated.userId);

    const me = await this.prisma.membership.findFirst({
      where: {
        conversationId: validated.conversationId,
        userId: validated.userId,
      },
      select: { clearedAt: true },
    });
    const floor = me?.clearedAt ?? new Date(0);

    const normalizedCursor = String(cursor ?? '').trim();
    if (normalizedCursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: normalizedCursor },
        select: {
          id: true,
          conversationId: true,
          kind: true,
          deletedAt: true,
          createdAt: true,
        },
      });

      if (!cursorMessage) {
        throw new BadRequestException('Invalid cursor: message not found');
      }

      if (cursorMessage.conversationId !== validated.conversationId) {
        throw new BadRequestException(
          'Invalid cursor: message belongs to a different conversation',
        );
      }

      if (cursorMessage.deletedAt) {
        throw new BadRequestException('Invalid cursor: message is deleted');
      }

      if (!kinds.includes(cursorMessage.kind)) {
        throw new BadRequestException(
          `Invalid cursor: message kind must be one of ${kinds.join(', ')}`,
        );
      }

      if (cursorMessage.createdAt <= floor) {
        throw new BadRequestException(
          'Invalid cursor: message is outside your visible range',
        );
      }
    }

    const items = await this.prisma.message.findMany({
      where: {
        conversationId: validated.conversationId,
        kind: { in: kinds },
        deletedAt: null,
        createdAt: { gt: floor },
      },
      orderBy: { createdAt: 'desc' },
      take: validated.take,
      ...(normalizedCursor
        ? { skip: 1, cursor: { id: normalizedCursor } }
        : {}),
      select: {
        id: true,
        kind: true, // IMAGE | VIDEO | FILE | AUDIO
        content: true, // e.g. { url, name, size, mime }
        createdAt: true,
        senderId: true,
        conversationId: true,
        media_Url: true,
      },
    });

    const nextCursor =
      items.length === validated.take ? items[items.length - 1].id : null;
    return { items, nextCursor };
  }

  /** Images & Videos */
  listMedia(
    conversationId: string,
    userId: string,
    cursor?: string,
    take = 20,
  ) {
    return this.listByKinds(
      conversationId,
      userId,
      ['IMAGE', 'VIDEO'],
      cursor,
      take,
    );
  }

  /** Files (docs, pdfs, etc.) */
  listFiles(
    conversationId: string,
    userId: string,
    cursor?: string,
    take = 20,
  ) {
    return this.listByKinds(conversationId, userId, ['FILE'], cursor, take);
  }

  /**
   * Search text messages (ILIKE on content->>'text').
   * Respects clearedAt and soft-deletes.
   */
  private validateSearchInputs(
    userId: string,
    q: string,
    conversationId?: string,
    take = 20,
    skip = 0,
  ) {
    const normalizedUserId = String(userId ?? '').trim();
    if (!normalizedUserId) {
      throw new BadRequestException('userId is required');
    }

    const normalizedQuery = String(q ?? '').trim();
    if (!normalizedQuery) {
      throw new BadRequestException('q is required');
    }

    if (normalizedQuery.length < 2) {
      throw new BadRequestException('q must be at least 2 characters');
    }

    const normalizedConversationId = String(conversationId ?? '').trim();

    const parsedTake = Number(take);
    if (!Number.isInteger(parsedTake) || parsedTake < 1) {
      throw new BadRequestException('take must be a positive integer');
    }

    const parsedSkip = Number(skip);
    if (!Number.isInteger(parsedSkip) || parsedSkip < 0) {
      throw new BadRequestException('skip must be a non-negative integer');
    }

    return {
      userId: normalizedUserId,
      q: normalizedQuery,
      conversationId: normalizedConversationId || undefined,
      take: Math.min(parsedTake, 100),
      skip: parsedSkip,
    };
  }

  async search(
    userId: string,
    q: string,
    conversationId?: string,
    take = 20,
    skip = 0,
  ) {
    const validated = this.validateSearchInputs(
      userId,
      q,
      conversationId,
      take,
      skip,
    );

    const safeTake = validated.take;
    const safeSkip = validated.skip;

    // If a single conversation search, verify membership & floor
    if (validated.conversationId) {
      // Single-conversation search: membership + per-user floor (clearedAt)
      await this.conv.ensureMember(validated.conversationId, validated.userId);
      const cleared = await this.prisma.membership.findFirst({
        where: {
          conversationId: validated.conversationId,
          userId: validated.userId,
        },
        select: { clearedAt: true },
      });
      const floor = cleared?.clearedAt ?? new Date(0);
      // IMPORTANT: Prisma model Message is mapped to physical table "messages" (see @@map in schema)
      return this.prisma.$queryRaw<any[]>`
        SELECT id, kind, content, message,
               "created_at" AS "createdAt",
               "sender_id" AS "senderId",
               "conversation_id" AS "conversationId",
               "media_url" AS "media_Url"
        FROM "messages"
        WHERE kind = 'TEXT'
          AND "conversation_id" = ${validated.conversationId}
          AND "created_at" > ${floor}
          AND "deleted_at" IS NULL
          AND (
            COALESCE(content->>'text', '') ILIKE '%' || ${validated.q} || '%'
            OR COALESCE(message, '') ILIKE '%' || ${validated.q} || '%'
          )
        ORDER BY "created_at" DESC
        LIMIT ${safeTake} OFFSET ${safeSkip}
      `;
    }

    // Multi-conversation search: restrict to user's memberships
    const memberConvIds = await this.prisma.membership.findMany({
      where: { userId: validated.userId },
      select: { conversationId: true, clearedAt: true },
    });
    if (memberConvIds.length === 0) return [];

    // Build temporary table of floors
    const convIds = memberConvIds.map((m) => m.conversationId);
    const floors: Record<string, Date> = {};
    memberConvIds.forEach(
      (m) => (floors[m.conversationId] = m.clearedAt ?? new Date(0)),
    );

    // Raw query limited to membership conversations; apply floor in post-filter (simpler & portable)
    // Build an IN clause safely. Using Prisma.sql join ensures proper parameterization.
    const inList = Prisma.join(convIds.map((id) => Prisma.sql`${id}`));
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT id, kind, content, message,
             "created_at" AS "createdAt",
             "sender_id" AS "senderId",
             "conversation_id" AS "conversationId",
             "media_url" AS "media_Url"
      FROM "messages"
      WHERE kind = 'TEXT'
        AND "conversation_id" IN (${inList})
        AND "deleted_at" IS NULL
        AND (
          COALESCE(content->>'text', '') ILIKE '%' || ${validated.q} || '%'
          OR COALESCE(message, '') ILIKE '%' || ${validated.q} || '%'
        )
      ORDER BY "created_at" DESC
      LIMIT ${safeTake} OFFSET ${safeSkip}
    `;

    return rows.filter((r) => r.createdAt > floors[r.conversationId]);
  }

  /**
   * Soft-delete a message.
   * Sender can delete their own message; group ADMIN can delete any message in that group.
   */
  async deleteMessage(messageId: string, byUserId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, conversationId: true },
    });
    if (!msg) return { ok: true }; // idempotent

    // allow sender OR group admin
    if (msg.senderId !== byUserId) {
      const m = await this.prisma.membership.findFirst({
        where: { conversationId: msg.conversationId, userId: byUserId },
        select: { role: true },
      });
      if (!m || m.role !== 'ADMIN') throw new ForbiddenException('Not allowed');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), deletedById: byUserId, content: {} },
    });
    return { ok: true };
  }

  /**
   * Report a message with an optional reason.
   */
  async reportMessage(messageId: string, byUserId: string, reason?: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    });
    if (!msg) throw new NotFoundException('Message not found');

    await this.conv.ensureMember(msg.conversationId, byUserId);

    const report = await this.prisma.report.create({
      data: {
        messageId,
        reporterId: byUserId,
        reason: reason?.trim()?.slice(0, 500) || 'Reported by user',
      },
      select: { id: true, status: true, createdAt: true },
    });
    return { ok: true, report };
  }
}
