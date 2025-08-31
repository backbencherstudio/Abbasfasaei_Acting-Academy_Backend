import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PresenceService {
  private online = new Set<string>(); // userIds online in this instance

  constructor(private prisma: PrismaService) {}

  async setOnline(userId: string) {
    this.online.add(userId);
  }

  async setOffline(userId: string) {
    this.online.delete(userId);
    // update lastSeenAt
    await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  isOnline(userId: string) {
    return this.online.has(userId);
  }

  async getPresence(userId: string) {
    const online = this.isOnline(userId);
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { lastSeenAt: true } });
    return { userId, online, lastSeenAt: u?.lastSeenAt ?? null };
  }

  async presenceForConversation(conversationId: string) {
    const members = await this.prisma.membership.findMany({
      where: { conversationId },
      select: { userId: true, user: { select: { lastSeenAt: true } } },
    });
    return members.map(m => ({
      userId: m.userId,
      online: this.isOnline(m.userId),
      lastSeenAt: m.user.lastSeenAt ?? null,
    }));
  }
}
