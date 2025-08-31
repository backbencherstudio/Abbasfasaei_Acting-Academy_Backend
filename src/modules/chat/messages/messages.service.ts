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
    take = 20,
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
      orderBy: { createdAt: 'desc' },
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

  /**
   * Send a message. For DMs, prevents sending if either user has blocked the other.
   */
  async send(
    conversationId: string,
    userId: string,
    kind: MessageKind | undefined,
    content: Prisma.InputJsonValue,
  ) {
    await this.conv.ensureMember(conversationId, userId);

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true, id: true },
    });
    if (!conv) throw new Error('Conversation not found');

    // For DMs, respect block list in either direction
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

    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        kind: kind ?? 'TEXT',
        content,
      },
      select: {
        id: true,
        kind: true,
        content: true,
        createdAt: true,
        senderId: true,
        conversationId: true,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return msg;
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
    const whereConv = conversationId
      ? Prisma.sql`AND "conversationId" = ${conversationId}`
      : Prisma.sql``;

    // Ensure access if conversationId provided
    if (conversationId) await this.conv.ensureMember(conversationId, userId);

    // Determine per-user floor (clearedAt)
    const clearedRow = conversationId
      ? await this.prisma.membership.findFirst({
          where: { conversationId, userId },
          select: { clearedAt: true },
        })
      : null;
    const floor = clearedRow?.clearedAt ?? new Date(0);

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT id, kind, content, "createdAt", "senderId", "conversationId"
      FROM "Message"
      WHERE kind = 'TEXT'
        ${whereConv}
        AND "createdAt" > ${floor}
        AND "deletedAt" IS NULL
        AND content->>'text' ILIKE '%' || ${q} || '%'
      ORDER BY "createdAt" DESC
      LIMIT ${take} OFFSET ${skip}
    `;
    return rows;
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
