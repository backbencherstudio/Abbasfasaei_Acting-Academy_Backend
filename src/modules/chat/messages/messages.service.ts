// src/messages/messages.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { CursorPaginationDto } from './dto/query-message.dto';
import { ChatRepository } from 'src/common/repository/chat/chat.repository';
import { SendMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}
  async getConversationMessages(
    conversation_id: string,
    user_id: string,
    query: CursorPaginationDto,
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first');
    if (!conversation_id)
      throw new BadRequestException('Invalid conversation id');

    const membership = await ChatRepository.getMembership(
      conversation_id,
      user_id,
    );

    if (!membership) throw new NotFoundException('Conversation not found');
    const { cursor, limit } = query;

    const messages = await this.prisma.message.findMany({
      where: {
        AND: [
          { conversation_id },
          { deleted_at: null },
          ...(membership.cleared_at
            ? [{ created_at: { gt: membership.cleared_at } }]
            : []),
          {
            OR: [
              {
                receipts: {
                  some: {
                    user_id: user_id,
                  },
                },
              },
              {
                sender_id: user_id,
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        conversation_id: true,
        kind: true,
        content: true,
        attachments: {
          select: {
            file_name: true,
            file_path: true,
            mime_type: true,
            type: true,
          },
          orderBy: { created_at: 'asc' },
        },
        reply_to: {
          select: {
            id: true,
            content: true,
            kind: true,
            sender_id: true,
            sender: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            attachments: {
              select: {
                type: true,
                file_path: true,
                file_name: true,
                mime_type: true,
              },
            },
          },
        },
        created_at: true,
        deleted_at: true,
        sender: {
          select: { id: true, name: true, avatar: true },
        },
        receipts: {
          select: {
            status: true,
            user_id: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    return {
      success: true,
      message: 'Message fetched successfully',
      data: messages.map((m) => ChatRepository.formatMessage(m)),
    };
  }

  async sendMessage(
    conversation_id: string,
    user_id: string,
    sendMessageDto: SendMessageDto,
    attachments?: Express.Multer.File[],
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first');
    if (!conversation_id)
      throw new BadRequestException('Invalid conversation id');

    const { content, kind, reply_to_id } = sendMessageDto;

    const attachmentData: Prisma.AttachmentCreateInput[] = [];

    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        try {
          const filename = NajimStorage.generateFileName(
            attachment.originalname,
          );
          const objectKey =
            appConfig().storageUrl.message_attachments + '/' + filename;
          await NajimStorage.put(objectKey, attachment.buffer);

          let type: 'IMAGE' | 'VIDEO' | 'FILE' = 'FILE';
          if (attachment.mimetype?.startsWith('image/')) {
            type = 'IMAGE';
          } else if (attachment.mimetype?.startsWith('video/')) {
            type = 'VIDEO';
          }

          attachmentData.push({
            file_name: attachment.originalname,
            file_path: objectKey,
            mime_type: attachment.mimetype,
            type,
            size_bytes: attachment.size,
          });
        } catch (error) {
          console.log('Error uploading attachment:', error);
        }
      }
    }

    if (!content && attachmentData.length < 1) {
      throw new BadRequestException('Message content is required');
    }
    const msg = await ChatRepository.sendMessage(
      conversation_id,
      user_id,
      {
        content,
        kind,
        replyToId: reply_to_id,
      },
      attachmentData,
    );

    return {
      success: true,
      message: 'Message sent successfully',
      data: msg,
    };
  }

  async deleteAMessage(message_id: string, user_id: string) {
    if (!message_id) throw new BadRequestException('Message id is required');

    const message = await this.prisma.message.findFirst({
      where: {
        id: message_id,
        sender_id: user_id,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!message) throw new NotFoundException('Message not found');

    await this.prisma.message.update({
      where: { id: message_id },
      data: {
        deleted_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'Message deleted successfully',
    };
  }
}
