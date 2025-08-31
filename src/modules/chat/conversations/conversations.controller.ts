import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateDmDto } from './dto/create-dm.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { id } from 'date-fns/locale';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { MemberRole } from '@prisma/client';


@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Post('dm')
  createDm(@GetUser() user: any, @Body() dto: CreateDmDto) {
    return this.service.createDm(user.userId, dto.otherUserId);
  }

  @Post('group')
  createGroup(@GetUser() user: any, @Body() dto: CreateGroupDto) {
    return this.service.createGroup(
      user.userId,
      dto.title,
      dto.memberIds,
      dto.avatarUrl,
    );
  }

  @Get()
  listMine(
    @GetUser() user: any,
    @Query('take') take = '20',
    @Query('skip') skip = '0',
  ) {
    return this.service.myConversations(
      user.userId,
      Number(take),
      Number(skip),
    );
  }

  // unread for one conversation
  @Get(':id/unread')
  unread(@Param('id') id: string, @GetUser() user: any) {
    return this.service.unreadFor(id, user.userId);
  }

  // mark read up to now or specific timestamp
  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @GetUser() user: any,
    @Body() body: { at?: string; messageCreatedAt?: string },
  ) {
    const at = body?.at
      ? new Date(body.at)
      : body?.messageCreatedAt
        ? new Date(body.messageCreatedAt)
        : undefined;
    return this.service.markRead(id, user.userId, at);
  }

  // --- member management ---
  @Post(':id/members')
  addMembers(
    @Param('id') id: string,
    @GetUser() user: any,
    @Body() body: { memberIds: string[] },
  ) {
    return this.service.addMembers(id, user.userId, body.memberIds || []);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.service.getGroupMembers(id);
  }

  @Patch(':id/members/:userId/role')
  setRole(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @GetUser() user: any,
    @Body() body: { role: MemberRole },
  ) {
    return this.service.setRole(id, user.userId, targetUserId, body.role);
  }

  @Post(':id/members/:userId/remove')
  remove(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @GetUser() user: any,
  ) {
    return this.service.removeMember(id, user.userId, targetUserId);
  }

  //------ clear conversation for me----
  @Patch(':id/clear')
  clearForMe(
    @Param('id') id,
    @GetUser() user: any,
    @Body() body?: { upTo?: string },
  ) {
    const upTo = body?.upTo ? new Date(body.upTo) : undefined;
    return this.service.clearForUser(id, user.userId, upTo);
  }
}
