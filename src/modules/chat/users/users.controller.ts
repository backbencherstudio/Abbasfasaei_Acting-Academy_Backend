import { Controller, Param, Post, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Post(':id/block')
  block(@GetUser() me: any, @Param('id') id: string) {
    return this.users.block(me.userId, id);
  }

  @Delete(':id/block')
  unblock(@GetUser() me: any, @Param('id') id: string) {
    return this.users.unblock(me.userId, id);
  }
}
