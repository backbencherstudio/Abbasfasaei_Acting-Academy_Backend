import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConversationType, MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import {
  AddMemberDto,
  CreateConversationDto,
  MarkAsReadDto,
} from './dto/create-conversation.dto';
import {
  AttachmentsQueryDto,
  ConversationQueryDto,
  QueryDiscoverUsersDto,
  QueryGroupMembersDto,
} from './dto/query-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async createConversation(
    user_id: string,
    createConversationDto: CreateConversationDto,
    group_avatar?: Express.Multer.File,
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first!');
    const { type, participant_id, participant_ids, title } =
      createConversationDto;

    if (participant_id === user_id || participant_ids?.includes(user_id))
      throw new BadRequestException('Invalid participants!');

    const where: Prisma.ConversationWhereInput = {
      type,
    };

    if (type === ConversationType.DM) {
      if (!participant_id)
        throw new BadRequestException('Participant id is required for DM');
      where.memberships = {
        some: {
          AND: [{ user_id: user_id }, { user_id: participant_id }],
        },
      };
    }
    let avatar: string;
    if (type === ConversationType.GROUP) {
      if (!title) throw new BadRequestException('Title is required for GROUP');
      if (!participant_ids || participant_ids.length < 1)
        throw new BadRequestException(
          'Participant ids is required for GROUP and must be more than 1',
        );
      where.title = { equals: title };
      if (group_avatar) {
        try {
          const filename = NajimStorage.generateFileName(
            group_avatar.originalname,
          );
          const objectKey =
            appConfig().storageUrl.conversation_avatar + '/' + filename;
          await NajimStorage.put(objectKey, group_avatar.buffer);
          avatar = objectKey;
        } catch (error) {
          throw new BadRequestException('Failed to upload group avatar');
        }
      }
    }

    const existConversation = await this.prisma.conversation.findFirst({
      where,
      select: {
        id: true,
        title: true,
        avatar: true,
        type: true,
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    });
    const existCount = existConversation?._count?.memberships;
    delete existConversation?._count;
    existConversation.avatar = existConversation.avatar
      ? NajimStorage.url(existConversation.avatar)
      : null;
    if (existConversation)
      return {
        success: true,
        message: 'Conversation already exists',
        data: { ...existConversation, total_members: existCount },
      };

    const conversation = await this.prisma.conversation.create({
      data: {
        type,
        creator_id: user_id,
        title,
        avatar: avatar,
        memberships: {
          create: [
            { user_id: user_id, role: MemberRole.ADMIN },
            ...(participant_id
              ? [{ user_id: participant_id }]
              : participant_ids?.length > 0
                ? participant_ids?.map((id) => ({ user_id: id }))
                : []),
          ],
        },
      },
      select: {
        id: true,
        title: true,
        avatar: true,
        type: true,
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    });

    const count = conversation._count.memberships;
    delete conversation._count;
    conversation.avatar = conversation.avatar
      ? NajimStorage.url(conversation.avatar)
      : null;
    return {
      success: true,
      message: 'Conversation created successfully',
      data: { ...conversation, total_members: count },
    };
  }

  async getMyConversations(user_id: string, query: ConversationQueryDto) {
    const { cursor, limit, type } = query;

    const where: Prisma.ConversationWhereInput = {
      memberships: {
        some: {
          user_id: user_id,
          left_at: null,
        },
      },
    };
    if (type) where.type = type;

    const conversations = await this.prisma.conversation.findMany({
      where,
      select: {
        id: true,
        title: true,
        avatar: true,
        type: true,
        messages: {
          where: {
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
          select: {
            id: true,
            content: true,
            created_at: true,
            sender: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
          take: 1,
          orderBy: {
            created_at: 'desc',
          },
        },
        memberships: {
          select: {
            cleared_at: true,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
          },
          where: {
            OR: [
              {
                user_id: user_id,
              },
              {
                user_id: {
                  not: user_id,
                },
              },
            ],
          },
          take: 2,
        },
        _count: {
          select: {
            memberships: true,
            messages: {
              where: {
                receipts: {
                  some: {
                    user_id: user_id,
                    status: {
                      not: 'READ',
                    },
                  },
                },
              },
            },
          },
        },
      },
      take: limit,
      cursor: cursor
        ? {
            id: cursor,
          }
        : undefined,
    });
    return {
      success: true,
      message: 'Conversations fetched successfully',
      data: conversations.map((conversation) => {
        const me = conversation.memberships?.find(
          (m) => m?.user?.id === user_id,
        );
        const other_member = conversation.memberships?.find(
          (m) => m?.user?.id !== user_id,
        );
        const { memberships: total_members, messages: unread_messages } =
          conversation._count;
        let last_message = conversation.messages?.[0];
        if (last_message && me?.cleared_at) {
          last_message =
            last_message.created_at > me?.cleared_at ? last_message : null;
        }
        delete conversation.messages;
        delete conversation.memberships;
        delete conversation._count;
        conversation.avatar = conversation.avatar
          ? NajimStorage.url(conversation.avatar)
          : other_member?.user?.avatar
            ? NajimStorage.url(other_member?.user?.avatar)
            : null;
        return {
          ...conversation,
          total_members,
          unread_messages,
          participant: other_member?.user ?? null,
          last_message: last_message
            ? { ...last_message, is_me: last_message.sender.id === user_id }
            : null,
        };
      }),
    };
  }

  async markAsRead(
    conversation_id: string,
    user_id: string,
    markAsReadDto: MarkAsReadDto,
  ) {
    if (!user_id) {
      throw new UnauthorizedException('Please login first!');
    }

    const { up_to_message_id } = markAsReadDto;

    if (!up_to_message_id) {
      throw new BadRequestException('Up to message id is required');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findFirst({
        where: {
          conversation_id,
          user_id,
        },
        select: {
          id: true,
          last_read_at: true,
        },
      });

      if (!membership) {
        throw new ForbiddenException('Not a member of this conversation');
      }

      const targetMessage = await tx.message.findFirst({
        where: {
          id: up_to_message_id,
          conversation_id,
        },
        select: {
          id: true,
          created_at: true,
        },
      });

      if (!targetMessage) {
        throw new BadRequestException('Message not found in this conversation');
      }

      await tx.membership.updateMany({
        where: {
          id: membership.id,
          OR: [
            { last_read_at: null },
            { last_read_at: { lt: targetMessage.created_at } },
          ],
        },
        data: {
          last_read_at: targetMessage.created_at,
        },
      });

      const updatedReceipts = await tx.receipt.updateMany({
        where: {
          user_id,
          status: {
            not: 'READ',
          },
          message: {
            conversation_id,
            sender_id: {
              not: user_id,
            },
            created_at: {
              lte: targetMessage.created_at,
            },
          },
        },
        data: {
          status: 'READ',
          at: now,
        },
      });

      return {
        last_read_at: targetMessage.created_at,
        marked_count: updatedReceipts.count,
      };
    });

    return {
      success: true,
      message: 'Messages marked as read successfully',
      data: result,
    };
  }

  async addMembers(
    conversation_id: string,
    user_id: string,
    addMemberDto: AddMemberDto,
  ) {
    if (!user_id) {
      throw new UnauthorizedException('Please login first!');
    }

    const { member_ids } = addMemberDto;

    if (!member_ids || member_ids.length < 1) {
      throw new BadRequestException('Member ids is required');
    }

    const count = await this.prisma.user.count({
      where: {
        id: {
          in: member_ids,
        },
      },
    });

    if (count !== member_ids.length) {
      throw new BadRequestException('Some users do not exist');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversation_id,
        memberships: {
          some: {
            user_id: user_id,
            role: 'ADMIN',
          },
        },
      },
    });

    if (!conversation) {
      throw new ForbiddenException('You are not admin of this conversation');
    }

    const newMembers = await this.prisma.membership.createMany({
      data: member_ids.map((member_id) => ({
        conversation_id,
        user_id: member_id,
        role: 'MEMBER',
      })),
      skipDuplicates: true,
    });

    if (newMembers?.count === 0) {
      throw new BadRequestException('Failed to add members');
    }

    return {
      success: true,
      message: 'Members added successfully',
    };
  }

  async getGroupMembers(
    conversation_id: string,
    user_id: string,
    query: QueryGroupMembersDto,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: conversation_id,
        memberships: { some: { user_id: user_id } },
      },
      select: { type: true },
    });
    if (!conversation) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const members = await this.prisma.membership.findMany({
      where: {
        conversation_id,
        ...(query.role ? { role: query.role } : {}),
      },
      select: {
        id: true,
        role: true,
        user: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
      orderBy: [{ role: 'desc' }, { joined_at: 'asc' }],
    });

    return members.map((m) => ({
      member_id: m.id,
      user_id: m?.user?.id,
      name: m?.user?.name,
      username: m?.user?.username,
      avatar: m?.user?.avatar ? NajimStorage.url(m?.user?.avatar) : null,
      role: m.role,
      is_me: m?.user?.id === user_id,
    }));
  }

  async removeMember(
    conversation_id: string,
    user_id: string,
    member_id: string,
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first!');

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversation_id,
        memberships: {
          some: {
            user_id: user_id,
            role: 'ADMIN',
          },
        },
      },
    });

    if (!conversation)
      throw new ForbiddenException('You are not admin of this conversation');

    const member = await this.prisma.membership.findFirst({
      where: {
        id: member_id,
        conversation_id,
      },
    });

    if (!member) throw new ForbiddenException('Member not found');

    await this.prisma.membership.delete({
      where: { conversation_id, id: member_id },
    });

    return {
      success: true,
      message: 'Member removed successfully',
    };
  }

  async updateMemberRole(
    conversation_id: string,
    user_id: string,
    member_id: string,
    role: MemberRole,
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first!');

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversation_id,
        memberships: {
          some: {
            user_id: user_id,
            role: 'ADMIN',
          },
        },
      },
    });

    if (!conversation)
      throw new ForbiddenException('You are not admin of this conversation');

    const member = await this.prisma.membership.findFirst({
      where: {
        id: member_id,
        conversation_id,
      },
    });

    if (!member) throw new ForbiddenException('Member not found');

    await this.prisma.membership.update({
      where: {
        id: member_id,
      },
      data: {
        role,
      },
    });

    return {
      success: true,
      message: 'Role updated successfully',
    };
  }

  async clearForMe(conversation_id: string, user_id: string) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.updateMany({
        where: { conversation_id, user_id },
        data: { cleared_at: now, last_read_at: now },
      });

      await tx.receipt.updateMany({
        where: {
          user_id,
          status: { not: 'READ' },
          message: { conversation_id },
        },
        data: {
          status: 'READ',
          at: now,
        },
      });
    });

    return {
      success: true,
      message: 'Conversation cleared successfully',
    };
  }

  async getAttachments(
    conversation_id: string,
    user_id: string,
    query: AttachmentsQueryDto,
  ) {
    const { cursor, limit, type } = query;

    const where: Prisma.AttachmentWhereInput = {
      message: {
        conversation_id,
        receipts: {
          some: {
            user_id,
          },
        },
      },
    };

    if (type === 'media') {
      where.OR = [
        { type: 'IMAGE' },
        { type: 'VIDEO' },
        { type: 'AUDIO' },
        { mime_type: { startsWith: 'image' } },
        { mime_type: { startsWith: 'video' } },
        { mime_type: { startsWith: 'audio' } },
      ];
    } else if (type === 'file') {
      where.OR = [
        { type: { not: 'IMAGE' } },
        { type: { not: 'VIDEO' } },
        { type: { not: 'AUDIO' } },
        { mime_type: { not: { startsWith: 'image' } } },
        { mime_type: { not: { startsWith: 'video' } } },
        { mime_type: { not: { startsWith: 'audio' } } },
      ];
    }

    const attachments = await this.prisma.attachment.findMany({
      where,
      select: {
        id: true,
        type: true,
        file_name: true,
        file_path: true,
        mime_type: true,
        message_id: true,
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const nextCursor =
      attachments.length > limit
        ? attachments[attachments.length - 1].id
        : null;
    const data = attachments.slice(0, limit).map((att) => ({
      id: att.id,
      type: att.type,
      file_name: att.file_name,
      file_path: att.file_path ? NajimStorage.url(att.file_path) : null,
      mime_type: att.mime_type,
      message_id: att.message_id,
    }));

    return {
      success: true,
      message: 'Attachments fetched successfully',
      data: data,
      meta_data: {
        limit,
        next_cursor: nextCursor,
      },
    };
  }

  async discoverUsers(user_id: string, query: QueryDiscoverUsersDto) {
    if (!user_id) throw new UnauthorizedException('Please login first');
    const { cursor, limit, search, type } = query;

    const where: Prisma.UserWhereInput = {};
  }
}
