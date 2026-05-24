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
import { QueryDiscoverUsersDto } from './dto/query-user.dto';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@UseGuards(JwtAuthGuard)
@Controller('users')
@DisAllowDeactivated()
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('discover')
  discoverUsers(
    @GetUser('userId') userId: string,
    @Query() query: QueryDiscoverUsersDto,
  ) {
    return this.users.discoverUsers(userId, query);
  }

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
