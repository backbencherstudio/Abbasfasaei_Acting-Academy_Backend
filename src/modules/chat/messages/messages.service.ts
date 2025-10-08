// src/messages/messages.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, MessageKind, ConversationType } from '@prisma/client';
import { ConversationsService } from '../conversations/conversations.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SazedStorage } from 'src/common/lib/disk/SazedStorage';
import appConfig from 'src/config/app.config';
import { StringHelper } from 'src/common/helper/string.helper';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private conv: ConversationsService,
    private users: UsersService,
  ) {}

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
      select: {
        id: true,
        kind: true,
        content: true,
        createdAt: true,
        senderId: true,
        conversationId: true,
      },
    });

    const nextCursor =
      items.length === take ? items[items.length - 1].id : null;
    return { items, nextCursor };
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
      const filename = `${StringHelper.randomString(10)}_${file.originalname}`;

      await SazedStorage.put(
        appConfig().storageUrl.attachment + `/${filename}`,
        file.buffer,
      );

      mediaUrl =
        process.env.AWS_S3_ENDPOINT +
        '/' +
        process.env.AWS_S3_BUCKET +
        appConfig().storageUrl.attachment +
        `/${filename}`;
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
        content : content ?? {},
        media_Url: mediaUrl,
        
      },
      select: {
        id: true,
        kind: true,
        content: true,
        createdAt: true,
        senderId: true,
        conversationId: true,
        media_Url: true,
      },
    });

    // console.log('msg:', msg);

    // Update the last message time for the conversation
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return msg;
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
  private async listByKinds(
    conversationId: string,
    userId: string,
    kinds: MessageKind[],
    cursor?: string,
    take = 20,
  ) {
    await this.conv.ensureMember(conversationId, userId);

    const me = await this.prisma.membership.findFirst({
      where: { conversationId, userId },
      select: { clearedAt: true },
    });
    const floor = me?.clearedAt ?? new Date(0);

    const items = await this.prisma.message.findMany({
      where: {
        conversationId,
        kind: { in: kinds },
        deletedAt: null,
        createdAt: { gt: floor },
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        kind: true, // IMAGE | VIDEO | FILE | AUDIO
        content: true, // e.g. { url, name, size, mime }
        createdAt: true,
        senderId: true,
        conversationId: true,
      },
    });

    const nextCursor =
      items.length === take ? items[items.length - 1].id : null;
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
  async search(
    userId: string,
    q: string,
    conversationId?: string,
    take = 20,
    skip = 0,
  ) {
    const safeTake = Math.min(take, 100);

    // If a single conversation search, verify membership & floor
    if (conversationId) {
      // Single-conversation search: membership + per-user floor (clearedAt)
      await this.conv.ensureMember(conversationId, userId);
      const cleared = await this.prisma.membership.findFirst({
        where: { conversationId, userId },
        select: { clearedAt: true },
      });
      const floor = cleared?.clearedAt ?? new Date(0);
      // IMPORTANT: Prisma model Message is mapped to physical table "messages" (see @@map in schema)
      return this.prisma.$queryRaw<any[]>`
        SELECT id, kind, content, "createdAt", "senderId", "conversationId"
        FROM "messages"
        WHERE kind = 'TEXT'
          AND "conversationId" = ${conversationId}
          AND "createdAt" > ${floor}
          AND "deletedAt" IS NULL
          AND content->>'text' ILIKE '%' || ${q} || '%'
        ORDER BY "createdAt" DESC
        LIMIT ${safeTake} OFFSET ${skip}
      `;
    }

    // Multi-conversation search: restrict to user's memberships
    const memberConvIds = await this.prisma.membership.findMany({
      where: { userId },
      select: { conversationId: true, clearedAt: true },
    });
    if (memberConvIds.length === 0) return [];

    // Build temporary table of floors
    const convIds = memberConvIds.map((m) => m.conversationId);
    const floors: Record<string, Date> = {};
    memberConvIds.forEach((m) => (floors[m.conversationId] = m.clearedAt ?? new Date(0)));

    // Raw query limited to membership conversations; apply floor in post-filter (simpler & portable)
    // Build an IN clause safely. Using Prisma.sql join ensures proper parameterization.
    const inList = Prisma.join(convIds.map((id) => Prisma.sql`${id}`));
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT id, kind, content, "createdAt", "senderId", "conversationId"
      FROM "messages"
      WHERE kind = 'TEXT'
        AND "conversationId" IN (${inList})
        AND "deletedAt" IS NULL
        AND content->>'text' ILIKE '%' || ${q} || '%'
      ORDER BY "createdAt" DESC
      LIMIT ${safeTake} OFFSET ${skip}
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
