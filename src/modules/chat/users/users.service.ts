import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // async suggestUsers(currentUserId: string, q: string, take = 10) {
  //   const term = (q ?? '').trim();
  //   if (term.length < 2) return { items: [] };

  //   const users = await this.prisma.user.findMany({
  //     where: {
  //       deleted_at: null,
  //       id: { not: currentUserId },
  //       AND: [
  //         { blocks_initiated: { none: { blockedId: currentUserId } } },
  //         { blocked_by: { none: { blockerId: currentUserId } } },
  //       ],
  //       OR: [
  //         { name: { contains: term, mode: 'insensitive' } },
  //         { username: { contains: term, mode: 'insensitive' } },
  //         { email: { startsWith: term, mode: 'insensitive' } },
  //       ],
  //     },
  //     select: {
  //       id: true,
  //       name: true,
  //       username: true,
  //       avatar: true,
  //     },
  //     take,
  //     orderBy: [{ name: 'asc' }],
  //   });

  //   // console.log('Suggested users:', users);

  //   const items = users.map((u) => ({
  //     id: u.id,
  //     name: u.name ?? 'Unknown',
  //     username: u.username ?? null,
  //     avatar_url: u.avatar
  //       ? /^https?:\/\//i.test(String(u.avatar))
  //         ? String(u.avatar)
  //         : NajimStorage.url(
  //             `${appConfig().storageUrl.avatar.replace(/^\/+/, '').replace(/\/+$/, '')}/${String(u.avatar).replace(/^\/+/, '')}`,
  //           )
  //       : null,
  //   }));

  //   // console.log('Final items:', items);

  //   return { items };
  // }

  async block(blockerId: string, targetUserId: string) {
    if (blockerId === targetUserId) {
      throw new ForbiddenException('Cannot block yourself');
    }

    await this.prisma.block.upsert({
      where: {
        blocker_id_blocked_id: {
          blocker_id: blockerId,
          blocked_id: targetUserId,
        },
      },
      update: {},
      create: {
        blocker_id: blockerId,
        blocked_id: targetUserId,
      },
    });

    return {
      success: true,
      message: 'User blocked successfully',
    };
  }

  async unblock(blockerId: string, targetUserId: string) {
    await this.prisma.block.deleteMany({
      where: {
        blocker_id: blockerId,
        blocked_id: targetUserId,
      },
    });

    return {
      success: true,
      message: 'User unblocked successfully',
    };
  }

  async getBlockStatus(currentUserId: string, targetUserId: string) {
    const [blockedByMe, blockedMe] = await Promise.all([
      this.prisma.block.count({
        where: {
          blocker_id: currentUserId,
          blocked_id: targetUserId,
        },
      }),
      this.prisma.block.count({
        where: {
          blocker_id: targetUserId,
          blocked_id: currentUserId,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        blocked_by_me: blockedByMe > 0,
        blocked_me: blockedMe > 0,
      },
    };
  }
}
