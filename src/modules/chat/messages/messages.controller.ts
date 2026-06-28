import type { Express } from 'express';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { CursorPaginationDto } from './dto/query-message.dto';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { SendMessageDto } from './dto/create-message.dto';

@UseGuards(JwtAuthGuard)
@Controller()
@DisAllowDeactivated()
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  // updated
  @Get('conversations/:conversation_id/messages')
  getConversationMessages(
    @Param('conversation_id') conversation_id: string,
    @GetUser('userId') user_id: string,
    @Query() query: CursorPaginationDto,
  ) {
    return this.service.getConversationMessages(
      conversation_id,
      user_id,
      query,
    );
  }

  // updated
  @Post('conversations/:conversation_id/messages')
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (
          !file.originalname.match(
            /.(jpg|jpeg|png|gif|mp4|mpeg|mkv|mov|avi|webp|pdf|doc|docx|txt|zip|rar|mp3|wav|ogg|m4a|aac|flac|wma)$/i,
          )
        ) {
          return cb(new BadRequestException('Invalid file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  sendMessage(
    @Param('conversation_id') conversationId: string,
    @GetUser('userId') user_id: string,
    @Body() sendMessageDto: SendMessageDto,
    @UploadedFiles() attachments?: Express.Multer.File[],
  ) {
    return this.service.sendMessage(
      conversationId,
      user_id,
      sendMessageDto,
      attachments,
    );
  }

  // updated
  @Delete('conversations/messages/:message_id')
  deleteAMessage(
    @Param('message_id') message_id: string,
    @GetUser('userId') user_id: string,
  ) {
    return this.service.deleteAMessage(message_id, user_id);
  }
}
