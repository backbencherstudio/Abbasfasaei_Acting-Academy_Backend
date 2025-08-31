import type { Express } from 'express';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { SendMessageDto } from '../conversations/dto/send-message.dto';

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
  list(
    @Param('id') conversationId: string,
    @GetUser() user: any,
    @Query('cursor') cursor?: string,
    @Query('take') take = '20',
  ) {
    return this.service.list(conversationId, user.userId, cursor, Number(take));
  }

  @Post('conversations/:id/messages')
  send(
    @Param('id') conversationId: string,
    @GetUser() user: any,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.send(
      conversationId,
      user.userId,
      dto.kind,
      dto.content,
    );
  }

  // /messages/search?q=hello&conversationId=...&take=20&skip=0
  @Get('messages/search')
  search(
    @GetUser() user: any,
    @Query('q') q: string,
    @Query('conversationId') conversationId?: string,
    @Query('take') take = '20',
    @Query('skip') skip = '0',
  ) {
    return this.service.search(
      user.userId,
      q || '',
      conversationId,
      Number(take),
      Number(skip),
    );
  }

  @Post('conversations/:id/messages/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: 'uploads', filename: fname }),
      limits: { fileSize: MAX_SIZE },
    }),
  )
  async uploadAndSend(
    @Param('id') conversationId: string,
    @GetUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('kind') kind: 'IMAGE' | 'FILE' | 'AUDIO' | 'VIDEO' = 'FILE',
  ) {
    const content = {
      url: `/uploads/${file.filename}`,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
    };
    return this.service.send(conversationId, user.userId, kind, content);
  }

  @Delete('messages/:messageId')
  remove(@Param('messageId') messageId: string, @GetUser() user: any) {
    return this.service.deleteMessage(messageId, user.userId);
  }

  @Post('messages/:messageId/report')
  report(
    @Param('messageId') messageId: string,
    @GetUser() user: any,
    @Body() body: { reason: string },
  ) {
    return this.service.reportMessage(
      messageId,
      user?.userId,
      body?.reason || 'No reason provided',
    );
  }

  // --- media & files ---
  @Get('conversations/:id/media')
  listMedia(
    @Param('id') conversationId: string,
    @GetUser() user: any,
    @Query('cursor') cursor?: string,
    @Query('take') take = '20',
  ) {
    return this.service.listMedia(
      conversationId,
      user.userId,
      cursor,
      Number(take),
    );
  }

  @Get('conversations/:id/files')
  listFiles(
    @Param('id') conversationId: string,
    @GetUser() user: any,
    @Query('cursor') cursor?: string,
    @Query('take') take = '20',
  ) {
    return this.service.listFiles(
      conversationId,
      user.userId,
      cursor,
      Number(take),
    );
  }
}
