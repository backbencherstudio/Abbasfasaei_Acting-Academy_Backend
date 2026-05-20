// src/messages/messages.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, MessageKind, ConversationType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { CursorPaginationDto } from './dto/query-message.dto';
import { SendMessageDto } from '../conversations/dto/create-conversation.dto';

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

    const membership = await this.prisma.membership.findFirst({
      where: {
        conversation_id: conversation_id,
        user_id: user_id,
        left_at: null,
      },
      select: { id: true, cleared_at: true },
    });

    if (!membership) throw new NotFoundException('Conversation not found');
    const { cursor, limit } = query;

    const messages = await this.prisma.message.findMany({
      where: {
        AND: [
          { conversation_id },
          { deleted_at: null },
          { created_at: { gt: membership.cleared_at } },
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
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    return {
      success: true,
      message: 'Message fetched successfully',
      data: messages.map((m) => {
        const { sender, attachments, reply_to } = m;
        return {
          ...m,
          reply_to: reply_to
            ? {
                ...reply_to,
                attachments: reply_to.attachments.map((att) => ({
                  ...att,
                  file_path: att?.file_path
                    ? NajimStorage.url(att.file_path)
                    : null,
                })),
              }
            : null,
          attachments: attachments.map((attachment) => {
            return {
              ...attachment,
              file_path: attachment?.file_path
                ? NajimStorage.url(attachment?.file_path)
                : null,
            };
          }),
          sender: {
            ...sender,
            avatar: sender?.avatar ? NajimStorage.url(sender?.avatar) : null,
          },
        };
      }),
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

    const membership = await this.prisma.membership.findFirst({
      where: {
        conversation_id: conversation_id,
        user_id: user_id,
      },
      select: {
        id: true,
        conversation: { select: { type: true } },
      },
    });

    if (!membership) throw new NotFoundException('Conversation not found');

    // Block checks only apply to DM conversations
    if (membership.conversation.type === 'DM') {
      const otherMember = await this.prisma.membership.findFirst({
        where: {
          conversation_id: conversation_id,
          user_id: { not: user_id },
        },
        select: { user_id: true },
      });

      if (otherMember) {
        const blockedByOther = await this.prisma.block.findFirst({
          where: {
            blocker_id: otherMember.user_id,
            blocked_id: user_id,
          },
        });
        if (blockedByOther)
          throw new BadRequestException('You have been blocked by this user');

        const blockedByMe = await this.prisma.block.findFirst({
          where: {
            blocker_id: user_id,
            blocked_id: otherMember.user_id,
          },
        });
        if (blockedByMe)
          throw new BadRequestException(
            'You have blocked this user. Unblock to send messages',
          );
      }
    }

    const { content, kind, reply_to_id } = sendMessageDto;

    // Validate reply_to_id if provided
    if (reply_to_id) {
      const replyMessage = await this.prisma.message.findFirst({
        where: {
          id: reply_to_id,
          conversation_id: conversation_id,
          deleted_at: null,
        },
        select: { id: true },
      });
      if (!replyMessage) {
        throw new BadRequestException(
          'Reply message not found in this conversation',
        );
      }
    }

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

    await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversation_id,
          sender_id: user_id,
          kind: kind || 'TEXT',
          content,
          ...(reply_to_id && { reply_to_id }),
          attachments: { create: attachmentData },
        },
      });

      // Create SENT receipts for unblocked, active members (excluding sender)
      const members = await tx.membership.findMany({
        where: {
          conversation_id,
          user_id: { not: user_id },
          left_at: null,
          user: {
            blocks_initiated: { none: { blocked_id: user_id } },
            blocked_by: { none: { blocker_id: user_id } },
          },
        },
        select: { user_id: true },
      });

      if (members.length > 0) {
        await tx.receipt.createMany({
          data: members.map((m) => ({
            message_id: msg.id,
            user_id: m.user_id,
            status: 'SENT' as const,
          })),
        });
      }
    });

    return {
      success: true,
      message: 'Message sent successfully',
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
