import {
  Controller,
  Param,
  Post,
  Delete,
  UseGuards,
  Query,
  Get,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@UseGuards(JwtAuthGuard)
@Controller('users')
@DisAllowDeactivated()
export class UsersController {
  constructor(private users: UsersService) {}

  // @Get('suggest')
  // async suggest(
  //   @GetUser() me: any,
  //   @Query('q') q: string,
  //   @Query('take') take = '10',
  // ) {
  //   const takeNumber = Number(take) || 10;

  //   return this.users.suggestUsers(me.userId, q, takeNumber);
  // }

  @Get(':id/block-status')
  getBlockStatus(@GetUser('userId') userId: string, @Param('id') id: string) {
    return this.users.getBlockStatus(userId, id);
  }

  @Post(':id/block')
  block(@GetUser('userId') userId: string, @Param('id') id: string) {
    return this.users.block(userId, id);
  }

  @Delete(':id/block')
  unblock(@GetUser('userId') userId: string, @Param('id') id: string) {
    return this.users.unblock(userId, id);
  }
}
