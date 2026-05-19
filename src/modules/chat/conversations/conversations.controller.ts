import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import {
  AddMemberDto,
  CreateConversationDto,
  MarkAsReadDto,
} from './dto/create-conversation.dto';
import { id } from 'date-fns/locale';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { ConversationType, MemberRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOkResponse } from '@nestjs/swagger';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import {
  ConversationQueryDto,
  QueryGroupMembersDto,
} from './dto/query-conversation.dto';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
@DisAllowDeactivated()
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

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
    return this.service.createConversation(
      user_id,
      createConversationDto,
      avatar,
    );
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
  markAsRead(
    @Param('conversation_id') conversation_id: string,
    @GetUser('userId') user_id: string,
    @Body() markAsReadDto: MarkAsReadDto,
  ) {
    return this.service.markAsRead(conversation_id, user_id, markAsReadDto);
  }

  //updated
  @Post(':conversation_id/members')
  addMembers(
    @Param('conversation_id') conversation_id: string,
    @GetUser('userId') user_id: string,
    @Body() addMemberDto: AddMemberDto,
  ) {
    return this.service.addMembers(conversation_id, user_id, addMemberDto);
  }

  // updated
  @Get(':conversation_id/members')
  getMembers(
    @Param('conversation_id') conversation_id: string,
    @GetUser('userId') user_id: string,
    @Query() query: QueryGroupMembersDto,
  ) {
    return this.service.getGroupMembers(conversation_id, user_id, query);
  }

  // updated
  @Patch(':conversation_id/members/:member_id/role')
  updateMemberRole(
    @Param('conversation_id') conversation_id: string,
    @Param('member_id') member_id: string,
    @GetUser('userId') user_id: string,
    @Body() body: { role: MemberRole },
  ) {
    return this.service.updateMemberRole(
      conversation_id,
      user_id,
      member_id,
      body.role,
    );
  }

  // updated
  @Delete(':conversation_id/members/:member_id')
  removeMember(
    @Param('conversation_id') conversation_id: string,
    @Param('member_id') member_id: string,
    @GetUser('userId') user_id: string,
  ) {
    return this.service.removeMember(conversation_id, user_id, member_id);
  }

  // updated
  @Patch(':conversation_id/clear')
  clearForMe(
    @Param('conversation_id') conversation_id: string,
    @GetUser('userId') user_id: string,
  ) {
    return this.service.clearForMe(conversation_id, user_id);
  }
}
