import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserStatus } from 'src/common/constants/user-status.enum';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Add your custom authentication logic here
    // for example, call super.logIn(request) to establish a session.
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    // if (!user.status || user.status === UserStatus.PENDING)
    //   throw new UnauthorizedException('your account is pending');

    // if (user.status === UserStatus.BLOCKED)
    //   throw new UnauthorizedException('your account is blocked');

    // if (user.status === UserStatus.DEACTIVATED)
    //   throw new UnauthorizedException('your account is deactivated');

    // if (user.status === UserStatus.REJECTED)
    //   throw new UnauthorizedException('your account is rejected');

    return user;
  }
}
