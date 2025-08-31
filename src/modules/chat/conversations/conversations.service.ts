import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { ConversationType, MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from '../users/users.service';


@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
  ) {}

  private dmKeyFor(a: string, b: string) {
    return [a, b].sort().join('_');
  }

  async ensureMember(conversationId: string, userId: string) {
    const m = await this.prisma.membership.findFirst({
      where: { conversationId, userId },
      select: { id: true },
    });
    if (!m) throw new ForbiddenException('Not a member of this conversation');
  }

  async requireAdmin(conversationId: string, userId: string) {
    const m = await this.prisma.membership.findFirst({
      where: { conversationId, userId },
      select: { role: true },
    });
    if (!m) throw new ForbiddenException('Not a member');
    if (m.role !== MemberRole.ADMIN) throw new ForbiddenException('Admin only');
  }

  async createDm(currentUserId: string, otherUserId: string) {
    if (currentUserId === otherUserId)
      throw new BadRequestException('Cannot DM yourself');
    const key = this.dmKeyFor(currentUserId, otherUserId);

    if (await this.users.isBlocked(currentUserId, otherUserId)) {
      throw new ForbiddenException('You are blocked from messaging this user');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: { type: ConversationType.DM, dmKey: key },
      include: { memberships: true },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        type: ConversationType.DM,
        dmKey: key,
        memberships: {
          create: [
            { userId: currentUserId, lastReadAt: new Date() },
            { userId: otherUserId, lastReadAt: new Date() },
          ],
        },
      },
      include: { memberships: true },
    });
  }

  async createGroup(
    currentUserId: string,
    title: string,
    memberIds: string[],
    avatarUrl?: string,
    createdBy?: string,
  ) {
    const uniqueMembers = Array.from(new Set([currentUserId, ...memberIds]));
    return this.prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        title,
        avatarUrl,
        createdBy: currentUserId,
        memberships: {
          create: uniqueMembers.map((uid) => ({
            userId: uid,
            role: uid === currentUserId ? 'ADMIN' : 'MEMBER',
            lastReadAt: new Date(),
          })),
        },
      },
      include: { memberships: true },
    });
  }

  async myConversations(
    userId: string,
    take = 20,
    skip = 0,
    opts?: {
      unreadOnly?: boolean;
      from?: Date;
      to?: Date;
    },
  ) {
    const convs = await this.prisma.conversation.findMany({
      where: {
        memberships: { some: { userId, archivedAt: null } },
        ...(opts?.from || opts?.to
          ? { updatedAt: { gte: opts?.from, lte: opts?.to } }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
      include: {
        memberships: {
          select: {
            userId: true,
            role: true,
            lastReadAt: true,
            clearedAt: true,
          },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const epoch = new Date(0);

    const results = await Promise.all(
      convs.map(async (c) => {
        const me = c.memberships.find((m) => m.userId === userId);
        const lowerBound = new Date(
          Math.max(
            me?.lastReadAt?.getTime() ?? 0,
            me?.clearedAt?.getTime() ?? 0,
          ),
        );

        const unread = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            deletedAt: null,
            createdAt: { gt: lowerBound },
            senderId: { not: userId },
          },
        });
        return { ...c, unread };
      }),
    );

    return opts?.unreadOnly ? results.filter((c) => c.unread > 0) : results;
  }

  async markRead(conversationId: string, userId: string, upTo?: Date) {
    await this.ensureMember(conversationId, userId);

    // Use latest message createdAt if not provided
    let at = upTo;
    if (!at) {
      const last = await this.prisma.message.findFirst({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      at = last?.createdAt ?? new Date();
    }

    // Update membership.lastReadAt to max(current, at)
    const m = await this.prisma.membership.findFirst({
      where: { conversationId, userId },
      select: { lastReadAt: true },
    });

    const floor = m?.lastReadAt ?? new Date(0);
    const candidate = at < floor ? floor : at;
    const next = m?.lastReadAt && m.lastReadAt > candidate ? m.lastReadAt : candidate;

    await this.prisma.membership.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: next },
    });

    // Return new unread count
    const unread = await this.prisma.message.count({
      where: {
        conversationId,
        createdAt: { gt: next },
        senderId: { not: userId },
      },
    });
    return { conversationId, lastReadAt: next, unread };
  }

  // ---- member management ----
async addMembers(
  conversationId: string,
  currentUserId: string,
  memberIds: string[],
) {
  await this.requireAdmin(conversationId, currentUserId);

  const unique = Array.from(new Set(memberIds));

  // Find existing members
  const existing = await this.prisma.membership.findMany({
    where: {
      conversationId,
      userId: { in: unique },
    },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map(m => m.userId));

  // Filter out already existing members
  const toAdd = unique.filter(uid => !existingIds.has(uid));
  if (toAdd.length === 0) {
    return { ok: false, message: 'All members already exist' };
  }

  await this.prisma.membership.createMany({
    data: toAdd.map((uid) => ({
      conversationId,
      userId: uid,
      role: 'MEMBER',
      lastReadAt: new Date(),
    })),
    skipDuplicates: true,
  });
  return { ok: true, added: toAdd };
}


  async getGroupMembers(conversationId: string) {
    const members = await this.prisma.membership.findMany({
      where: { conversationId },
      select: {
        userId: true,
        role: true,
        user: { select: { name: true } }, 
      },
    });
    return members.map(m => ({
      userId: m.userId,
      displayName: m.user.name, 
      role: m.role,
    }));
  }

  async removeMember(
    conversationId: string,
    currentUserId: string,
    targetUserId: string,
  ) {
    await this.requireAdmin(conversationId, currentUserId);
    await this.prisma.membership.deleteMany({
      where: { conversationId, userId: targetUserId },
    });
    return { ok: true };
  }

  async setRole(
    conversationId: string,
    currentUserId: string,
    targetUserId: string,
    role: MemberRole,
  ) {
    await this.requireAdmin(conversationId, currentUserId);
    await this.prisma.membership.updateMany({
      where: { conversationId, userId: targetUserId },
      data: { role },
    });
    return { ok: true };
  }

  async unreadFor(conversationId: string, userId: string) {
    const me = await this.prisma.membership.findFirst({
      where: { conversationId, userId },
      select: { lastReadAt: true },
    });
    if (!me) throw new ForbiddenException('Not a member');
    const unread = await this.prisma.message.count({
      where: {
        conversationId,
        createdAt: { gt: me.lastReadAt ?? new Date(0) },
        senderId: { not: userId },
      },
    });
    return { conversationId, unread };
  }

  async clearForUser(conversationId: string, userId: string, upTo?: Date) {
    await this.ensureMember(conversationId, userId);

    const at = upTo ?? new Date();

    await this.prisma.membership.updateMany({
      where: { conversationId, userId },
      data: { clearedAt: at, lastReadAt: at },
    });

    return { ok: true, conversationId, clearedAt: at.toISOString() };
  }
}
