import {
  BadRequestException,
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
import { CreateConversationDto } from './dto/create-conversation.dto';
import { id } from 'date-fns/locale';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { ConversationType, MemberRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOkResponse } from '@nestjs/swagger';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { ConversationQueryDto } from './dto/query-conversation.dto';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
@DisAllowDeactivated()
export class ConversationsController {
  constructor(private readonly service: ConversationsService) { }

  // updated
  @Post()
  @ApiOkResponse({ description: 'Conversation created successfully.' })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
    }),
  )
  createConversation(
    @GetUser('userId') user_id: string,
    @Body() createConversationDto: CreateConversationDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.service.createConversation(user_id, createConversationDto, avatar);
  }


  // updated
  @Get()
  getMyConversations(
    @GetUser('userId') user_id: string,
    @Query() query: ConversationQueryDto,
  ) {
    return this.service.getMyConversations(user_id, query);
  }

  // updated
  @Patch(':conversation_id/read')
  markRead(
    @Param('conversation_id') conversation_id: string,
    @GetUser('userId') user_id: string,
  ) {
    return this.service.markRead(conversation_id, user_id);
  }





  // --- member management ---
  // updated
  @Post(':conversation_id/members')
  addMembers(
    @Param('conversation_id') conversation_id: string,
    @GetUser('userId') user_id: string,
    @Body() body: { memberIds: string[] },
  ) {
    return this.service.addMembers(conversation_id, user_id, body.memberIds || []);
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
