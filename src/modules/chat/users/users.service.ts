import { ForbiddenException, Injectable } from '@nestjs/common';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async suggestUsers(currentUserId: string, q: string, take = 10) {
    const term = (q ?? '').trim();
    if (term.length < 2) return { items: [] };

    const users = await this.prisma.user.findMany({
      where: {
        deleted_at: null,
        id: { not: currentUserId },
        AND: [
          { blocks_initiated: { none: { blockedId: currentUserId } } },
          { blocked_by: { none: { blockerId: currentUserId } } },
        ],
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
          { email: { startsWith: term, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
      },
      take,
      orderBy: [{ name: 'asc' }],
    });

    // console.log('Suggested users:', users);

    const items = users.map((u) => ({
      id: u.id,
      name: u.name ?? 'Unknown',
      username: u.username ?? null,
      avatar_url: u.avatar
        ? /^https?:\/\//i.test(String(u.avatar))
          ? String(u.avatar)
          : SazedStorage.url(
              `${appConfig().storageUrl.avatar.replace(/^\/+/, '').replace(/\/+$/, '')}/${String(u.avatar).replace(/^\/+/, '')}`,
            )
        : null,
    }));

    // console.log('Final items:', items);

    return { items };
  }

  async block(blockerId: string, targetUserId: string) {
    if (blockerId === targetUserId)
      throw new ForbiddenException('Cannot block yourself');
    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId: targetUserId } },
      update: {},
      create: { blockerId, blockedId: targetUserId },
    });
    return { ok: true };
  }

  async unblock(blockerId: string, targetUserId: string) {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId: targetUserId },
    });
    return { ok: true };
  }

  async isBlocked(a: string, b: string) {
    // either direction
    const cnt = await this.prisma.block.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return cnt > 0;
  }
}
