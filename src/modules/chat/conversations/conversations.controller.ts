import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateDmDto } from './dto/create-dm.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { id } from 'date-fns/locale';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { MemberRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOkResponse } from '@nestjs/swagger';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
@DisAllowDeactivated()
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Post('dm')
  createDm(@GetUser() user: any, @Body() dto: CreateDmDto) {
    return this.service.createDm(user.userId, dto.otherUserId);
  }

  @Post('group')
  @ApiOkResponse({ description: 'Group conversation created successfully.' })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
    }),
  )
  createGroup(
    @GetUser() user: any,
    @Body() dto: CreateGroupDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.service.createGroup(
      user.userId,
      dto.title,
      dto.memberIds,
      avatar,
    );
  }

  @Get('group-conversations')
  listGroupConversations(@GetUser() user: any) {
    return this.service.listGroupConversations(user.userId);
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
  getMembers(
    @Param('id') id: string,
    @GetUser() user: any,
    @Query('role') role?: MemberRole,
  ) {
    return this.service.getGroupMembers(id, user.userId, role);
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
