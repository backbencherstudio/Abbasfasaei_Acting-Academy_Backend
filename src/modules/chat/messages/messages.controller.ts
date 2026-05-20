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
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { SendMessageDto } from '../conversations/dto/create-conversation.dto';
import {
  SearchMessagesDto,
  CursorPaginationDto,
} from './dto/query-message.dto';
import { ReportMessageDto } from './dto/create-message.dto';
import { text } from 'stream/consumers';

const MAX_SIZE = 10 * 1024 * 1024;
function fname(_, file, cb) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  cb(null, id + extname(file.originalname));
}

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
@DisAllowDeactivated()
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

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

  @Post('conversations/:conversation_id/messages')
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (
          !file.originalname.match(
            /.(jpg|jpeg|png|gif|mp4|mpeg|mkv|mov|avi|webp|pdf|doc|docx|txt|zip|rar)$/i,
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

  // // /messages/search?q=hello&conversationId=...&take=20&skip=0
  // @Get('messages/search')
  // @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  // search(@GetUser() user: any, @Query() dto: SearchMessagesDto) {
  //   return this.service.search(
  //     user.userId,
  //     dto.q,
  //     dto.conversationId,
  //     dto.take,
  //     dto.skip,
  //   );
  // }

  // @Post('conversations/:id/messages/upload')
  // @UseInterceptors(
  //   FileInterceptor('media', {
  //     storage: memoryStorage(),
  //   }),
  // )
  // @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  // async uploadAndSend(
  //   @Param('id') conversationId: string,
  //   @GetUser() user: any,
  //   @UploadedFile() file: Express.Multer.File,
  //   @Body() dto: SendMessageDto,
  // ) {
  //   // Accept empty string or '{}' for content
  //   if (typeof dto.content === 'string') {
  //     if (dto.content === '' || dto.content === '{}') {
  //       dto.content = {};
  //     } else {
  //       try {
  //         dto.content = JSON.parse(dto.content);
  //       } catch {
  //         throw new BadRequestException('content must be a valid JSON object');
  //       }
  //     }
  //   }
  //   return this.service.sendMessage(
  //     conversationId,
  //     user.userId,
  //     dto.kind,
  //     dto.content,
  //     file,
  //     dto.media_Url,
  //   );
  // }

  // @Delete('messages/:messageId')
  // remove(@Param('messageId') messageId: string, @GetUser() user: any) {
  //   return this.service.deleteMessage(messageId, user.userId);
  // }

  // @Post('messages/:messageId/report')
  // @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  // report(
  //   @Param('messageId') messageId: string,
  //   @GetUser() user: any,
  //   @Body() body: ReportMessageDto,
  // ) {
  //   return this.service.reportMessage(
  //     messageId,
  //     user?.userId,
  //     body?.reason || 'Reported by user',
  //   );
  // }

  // // --- media & files ---
  // @Get('conversations/:id/media')
  // @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  // listMedia(
  //   @Param('id') conversationId: string,
  //   @GetUser() user: any,
  //   @Query() query: CursorPaginationDto,
  // ) {
  //   return this.service.listMedia(
  //     conversationId,
  //     user.userId,
  //     query.cursor,
  //     query.take,
  //   );
  // }

  // @Get('conversations/:id/files')
  // @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  // listFiles(
  //   @Param('id') conversationId: string,
  //   @GetUser() user: any,
  //   @Query() query: CursorPaginationDto,
  // ) {
  //   return this.service.listFiles(
  //     conversationId,
  //     user.userId,
  //     query.cursor,
  //     query.take,
  //   );
  // }
}
