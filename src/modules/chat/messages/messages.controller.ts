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
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { SendMessageDto } from '../conversations/dto/send-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';
import { ReportMessageDto } from './dto/report-message.dto';
import { CursorPaginationDto } from './dto/pagination.dto';
import { text } from 'stream/consumers';

const MAX_SIZE = 10 * 1024 * 1024;
function fname(_, file, cb) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  cb(null, id + extname(file.originalname));
}

@UseGuards(JwtAuthGuard)
@Controller()
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Get('conversations/:id/messages')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  list(
    @Param('id') conversationId: string,
    @GetUser() user: any,
    @Query() query: CursorPaginationDto,
  ) {
    return this.service.list(
      conversationId,
      user.userId,
      query.cursor,
      query.take,
    );
  }

  // @Post('conversations/:id/messages')
  // sendMessage(
  //   @Param('id') conversationId: string,
  //   @GetUser() user: any,
  //   @Body() dto: SendMessageDto,
  // ) {
  //   return this.service.sendMessage(
  //     conversationId,
  //     user.userId,
  //     dto.kind,
  //     dto.content,
  //   );
  // }

  // /messages/search?q=hello&conversationId=...&take=20&skip=0
  @Get('messages/search')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  search(
    @GetUser() user: any,
    @Query() dto: SearchMessagesDto,
  ) {
    return this.service.search(
      user.userId,
      dto.q,
      dto.conversationId,
      dto.take,
      dto.skip,
    );
  }

  @Post('conversations/:id/messages/upload')
  @UseInterceptors(
    FileInterceptor('media', {
      storage: memoryStorage(),
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async uploadAndSend(
    @Param('id') conversationId: string,
    @GetUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SendMessageDto,
  ) {
    // Accept empty string or '{}' for content
    if (typeof dto.content === 'string') {
      if (dto.content === '' || dto.content === '{}') {
        dto.content = {};
      } else {
        try {
          dto.content = JSON.parse(dto.content);
        } catch {
          throw new BadRequestException('content must be a valid JSON object');
        }
      }
    }
    return this.service.sendMessage(
      conversationId,
      user.userId,
      dto.kind,
      dto.content,
      file,
      dto.media_Url,
    );
  }

  @Delete('messages/:messageId')
  remove(@Param('messageId') messageId: string, @GetUser() user: any) {
    return this.service.deleteMessage(messageId, user.userId);
  }

  @Post('messages/:messageId/report')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  report(
    @Param('messageId') messageId: string,
    @GetUser() user: any,
    @Body() body: ReportMessageDto,
  ) {
    return this.service.reportMessage(
      messageId,
      user?.userId,
      body?.reason || 'Reported by user',
    );
  }

  // --- media & files ---
  @Get('conversations/:id/media')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  listMedia(
    @Param('id') conversationId: string,
    @GetUser() user: any,
    @Query() query: CursorPaginationDto,
  ) {
    return this.service.listMedia(
      conversationId,
      user.userId,
      query.cursor,
      query.take,
    );
  }

  @Get('conversations/:id/files')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  listFiles(
    @Param('id') conversationId: string,
    @GetUser() user: any,
    @Query() query: CursorPaginationDto,
  ) {
    return this.service.listFiles(
      conversationId,
      user.userId,
      query.cursor,
      query.take,
    );
  }
}
