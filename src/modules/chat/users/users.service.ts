import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async block(blockerId: string, targetUserId: string) {
    if (blockerId === targetUserId) throw new ForbiddenException('Cannot block yourself');
    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId: targetUserId } },
      update: {},
      create: { blockerId, blockedId: targetUserId },
    });
    return { ok: true };
  }

  async unblock(blockerId: string, targetUserId: string) {
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId: targetUserId } });
    return { ok: true };
  }

  async isBlocked(a: string, b: string) {
    // either direction
    const cnt = await this.prisma.block.count({
      where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    });
    return cnt > 0;
  }
}
