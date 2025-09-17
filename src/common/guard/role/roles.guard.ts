import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './role.enum';
import { UserRepository } from '../../../common/repository/user/user.repository';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

  const userDetails = await UserRepository.getUserDetails(user.userId);

    if (!userDetails) {
      return false;
    }

    // Normalize role checks from attached roles only
    const attachedRoleNames = (userDetails.role_users || [])
      .map((ru) => ru?.role?.name)
      .filter(Boolean)
      .map((name) => String(name).toLowerCase());

    // If user is super admin by type or attached role, allow all
    const isSuperAdmin = attachedRoleNames.includes('su_admin');
    if (isSuperAdmin) {
      return true;
    }

    // Check if any required Role matches user's type or attached roles
    const hasRequiredRole = requiredRoles.some((required) =>
      attachedRoleNames.includes(String(required).toLowerCase()),
    );

    if (hasRequiredRole) {
      return true;
    }

    throw new HttpException(
      'You do not have permission to access this resource',
      HttpStatus.FORBIDDEN,
    );
  }
}
