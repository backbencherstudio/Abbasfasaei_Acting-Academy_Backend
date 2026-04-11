import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DISALLOW_DEACTIVATED_KEY } from '../decorators/disallow-deactivated.decorator';
import { UserStatus } from '../constants/user-status.enum';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserStatusGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user (public route), allow the request (JwtAuthGuard handles auth)
    if (!user || !user.userId) {
      return true;
    }

    // Fetch latest user status from DB
    const userDetails = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { status: true },
    });

    if (!userDetails) {
      return true;
    }

    const { status } = userDetails;

    // 1. Always block BLOCKED users
    if (status === UserStatus.BLOCKED) {
      throw new ForbiddenException(
        'Your account has been blocked by an administrator.',
      );
    }

    // 2. Check for DEACTIVATED users
    if (status === UserStatus.DEACTIVATED) {
      const isBlacklisted = this.reflector.getAllAndOverride<boolean>(
        DISALLOW_DEACTIVATED_KEY,
        [context.getHandler(), context.getClass()],
      );

      // If the route is explicitly blacklisted for deactivated users
      if (isBlacklisted) {
        throw new ForbiddenException(
          'Account deactivated. Please reactivate your account to continue.',
        );
      }
    }

    return true;
  }
}
