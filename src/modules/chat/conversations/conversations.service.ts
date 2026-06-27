import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConversationType, MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChatRepository } from 'src/common/repository/chat/chat.repository';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { UserStatus } from 'src/common/constants/user-status.enum';
import {
  AddMemberDto,
  ConversationSilentMode,
  CreateUserReportDto,
  CreateConversationDto,
  MarkAsReadDto,
  UpdateConversationSilentDto,
} from './dto/create-conversation.dto';
import {
  AttachmentsQueryDto,
  ConversationQueryDto,
  QueryGroupMembersDto,
} from './dto/query-conversation.dto';

const FOREVER_MUTE_UNTIL = new Date('9999-12-31T23:59:59.999Z');

function normalizeConversationSilentState(mutedUntil: Date | null) {
  if (!mutedUntil || mutedUntil.getTime() <= Date.now()) {
    return {
      is_silenced: false,
      mode: ConversationSilentMode.OFF,
      muted_until: null,
    };
  }

  if (mutedUntil.getTime() === FOREVER_MUTE_UNTIL.getTime()) {
    return {
      is_silenced: true,
      mode: ConversationSilentMode.FOREVER,
      muted_until: mutedUntil,
    };
  }

  return {
    is_silenced: true,
    mode: ConversationSilentMode.UNTIL,
    muted_until: mutedUntil,
  };
}

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  private async promoteNextGroupAdmin(
    tx: Prisma.TransactionClient,
    conversation_id: string,
    excludedUserIds: string[],
  ) {
    const nextAdmin = await tx.membership.findFirst({
      where: {
        conversation_id,
        left_at: null,
        user_id: {
          notIn: excludedUserIds,
        },
      },
      orderBy: {
        joined_at: 'asc',
      },
      select: {
        id: true,
        user_id: true,
      },
    });

    if (!nextAdmin) return null;

    await tx.membership.update({
      where: {
        id: nextAdmin.id,
      },
      data: {
        role: MemberRole.ADMIN,
      },
    });

    return nextAdmin;
  }

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
      where.AND = [
        { memberships: { some: { user_id: user_id, left_at: null } } },
        { memberships: { some: { user_id: participant_id, left_at: null } } },
      ];
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

    if (existConversation) {
      const existCount = existConversation._count?.memberships;
      const { _count, ...rest } = existConversation;
      rest.avatar = rest.avatar ? NajimStorage.url(rest.avatar) : null;
      return {
        success: true,
        message: 'Conversation already exists',
        data: { ...rest, total_members: existCount },
      };
    }

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
    const { cursor, limit, type, search } = query;

    const where: Prisma.ConversationWhereInput = {
      memberships: {
        some: {
          user_id: user_id,
          left_at: null,
        },
      },
    };
    if (type) where.type = type;

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { memberships: { some: { user: { name: { contains: search } } } } },
        { memberships: { some: { user: { username: { contains: search } } } } },
        { memberships: { some: { user: { email: { contains: search } } } } },
        {
          memberships: {
            some: { user: { phone_number: { contains: search } } },
          },
        },
      ];
    }

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
            muted_until: true,
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
            left_at: null,
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
      orderBy: { updated_at: 'desc' },
      take: limit + 1,
      cursor: cursor
        ? {
            id: cursor,
          }
        : undefined,
    });
    let nextCursor = null;
    if (conversations.length > limit) {
      const lastConversation = conversations[conversations.length - 1];
      nextCursor = lastConversation?.id;
      conversations.pop();
    }
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
        const silentState = normalizeConversationSilentState(
          me?.muted_until ?? null,
        );
        const { memberships: total_members, messages: unread_messages } =
          conversation._count;
        let last_message = conversation.messages?.[0] ?? null;
        if (last_message && me?.cleared_at) {
          last_message =
            last_message.created_at > me?.cleared_at ? last_message : null;
        }
        const {
          messages: _msgs,
          memberships: _mbrs,
          _count: _cnt,
          ...conv
        } = conversation;
        conv.avatar = conv.avatar
          ? NajimStorage.url(conv.avatar)
          : other_member?.user?.avatar
            ? NajimStorage.url(other_member?.user?.avatar)
            : null;
        return {
          ...conv,
          total_members,
          unread_messages,
          participant: other_member?.user ?? null,
          is_silenced: silentState.is_silenced,
          muted_until: silentState.muted_until,
          last_message: last_message
            ? { ...last_message, is_me: last_message.sender.id === user_id }
            : null,
        };
      }),
      meta_data: {
        limit,
        search,
        type,
        next_cursor: nextCursor,
      },
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

    const membership = await ChatRepository.getMembership(
      conversation_id,
      user_id,
    );
    if (!membership) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    const result = await ChatRepository.markAsRead(
      conversation_id,
      user_id,
      up_to_message_id,
    );

    if (!result) {
      throw new BadRequestException('Message not found in this conversation');
    }

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

    const member_ids = [...new Set(addMemberDto.member_ids || [])];

    if (!member_ids || member_ids.length < 1) {
      throw new BadRequestException('Member ids is required');
    }

    if (member_ids.includes(user_id)) {
      throw new BadRequestException('You are already in this conversation');
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

    const membership = await ChatRepository.getMembership(
      conversation_id,
      user_id,
    );

    if (!membership || membership.role !== 'ADMIN') {
      throw new ForbiddenException('You are not admin of this conversation');
    }

    const existingMemberships = await this.prisma.membership.findMany({
      where: {
        conversation_id,
        user_id: {
          in: member_ids,
        },
      },
      select: {
        id: true,
        user_id: true,
        left_at: true,
      },
    });

    const existingUserIds = new Set(
      existingMemberships.map((existing) => existing.user_id),
    );
    const returningMembershipIds = existingMemberships
      .filter((existing) => existing.left_at)
      .map((existing) => existing.id);
    const newUserIds = member_ids.filter(
      (member_id) => !existingUserIds.has(member_id),
    );

    const now = new Date();

    if (returningMembershipIds.length > 0) {
      await this.prisma.membership.updateMany({
        where: {
          id: {
            in: returningMembershipIds,
          },
        },
        data: {
          left_at: null,
          archived_at: null,
          joined_at: now,
          cleared_at: null,
          last_read_at: null,
          role: MemberRole.MEMBER,
        },
      });
    }

    let createdCount = 0;
    if (newUserIds.length > 0) {
      const newMembers = await this.prisma.membership.createMany({
        data: newUserIds.map((member_id) => ({
          conversation_id,
          user_id: member_id,
          role: MemberRole.MEMBER,
        })),
        skipDuplicates: true,
      });
      createdCount = newMembers.count;
    }

    if (createdCount === 0 && returningMembershipIds.length === 0) {
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
    await ChatRepository.ensureMember(conversation_id, user_id);

    const members = await this.prisma.membership.findMany({
      where: {
        conversation_id,
        left_at: null,
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

    const total = await this.prisma.membership.count({
      where: {
        conversation_id,
        left_at: null,
      },
    });

    return {
      success: true,
      message: 'Group members fetched successfully',
      data: members.map((m) => ({
        member_id: m.id,
        user_id: m?.user?.id,
        name: m?.user?.name,
        username: m?.user?.username,
        avatar: m?.user?.avatar ? NajimStorage.url(m?.user?.avatar) : null,
        role: m.role,
        is_me: m?.user?.id === user_id,
      })),
      meta_data: {
        total,
      },
    };
  }

  async removeMember(
    conversation_id: string,
    user_id: string,
    member_id: string,
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first!');

    const membership = await ChatRepository.getMembership(
      conversation_id,
      user_id,
    );

    if (!membership || membership.role !== 'ADMIN') {
      throw new ForbiddenException('You are not admin of this conversation');
    }

    const member = await this.prisma.membership.findFirst({
      where: {
        id: member_id,
        conversation_id,
        left_at: null,
      },
      select: {
        id: true,
        user_id: true,
        role: true,
      },
    });

    if (!member) throw new ForbiddenException('Member not found');

    if (member.user_id === user_id) {
      throw new BadRequestException(
        'Use leave conversation to remove yourself from the group',
      );
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: {
          id: member.id,
        },
        data: {
          left_at: now,
        },
      });

      if (member.role === MemberRole.ADMIN) {
        const otherAdminsCount = await tx.membership.count({
          where: {
            conversation_id,
            left_at: null,
            role: MemberRole.ADMIN,
            user_id: {
              notIn: [user_id, member.user_id],
            },
          },
        });

        if (otherAdminsCount === 0) {
          await this.promoteNextGroupAdmin(tx, conversation_id, [
            user_id,
            member.user_id,
          ]);
        }
      }
    });

    return {
      success: true,
      message: 'Member removed successfully',
    };
  }

  async leaveConversation(conversation_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException('Please login first!');

    const membership = await this.prisma.membership.findFirst({
      where: {
        conversation_id,
        user_id,
        left_at: null,
      },
      select: {
        id: true,
        role: true,
        conversation: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    if (!membership?.conversation) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    if (membership.conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Only group conversations can be left');
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const activeMembers = await tx.membership.findMany({
        where: {
          conversation_id,
          left_at: null,
        },
        orderBy: {
          joined_at: 'asc',
        },
        select: {
          id: true,
          user_id: true,
          role: true,
        },
      });

      if (activeMembers.length <= 1) {
        await tx.conversation.delete({
          where: {
            id: conversation_id,
          },
        });

        return {
          deleted: true,
          new_admin_user_id: null,
        };
      }

      let newAdminUserId: string | null = null;

      if (membership.role === MemberRole.ADMIN) {
        const otherAdmins = activeMembers.filter(
          (member) =>
            member.user_id !== user_id && member.role === MemberRole.ADMIN,
        );

        if (otherAdmins.length === 0) {
          const nextAdmin = await this.promoteNextGroupAdmin(
            tx,
            conversation_id,
            [user_id],
          );
          newAdminUserId = nextAdmin?.user_id ?? null;
        }
      }

      await tx.membership.update({
        where: {
          id: membership.id,
        },
        data: {
          left_at: now,
        },
      });

      return {
        deleted: false,
        new_admin_user_id: newAdminUserId,
      };
    });

    return {
      success: true,
      message: result.deleted
        ? 'Group deleted because no active members remained'
        : 'You left the conversation successfully',
      data: result,
    };
  }

  async deleteConversation(conversation_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException('Please login first!');

    const membership = await this.prisma.membership.findFirst({
      where: {
        conversation_id,
        user_id,
        left_at: null,
      },
      select: {
        id: true,
        role: true,
        conversation: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    if (!membership?.conversation) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    if (
      membership.conversation.type === ConversationType.GROUP &&
      membership.role !== MemberRole.ADMIN
    ) {
      throw new ForbiddenException('Only admin can delete this conversation');
    }

    await this.prisma.conversation.delete({
      where: {
        id: conversation_id,
      },
    });

    return {
      success: true,
      message: 'Conversation deleted successfully',
    };
  }

  async updateMemberRole(
    conversation_id: string,
    user_id: string,
    member_id: string,
    role: MemberRole,
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first!');

    const membership = await ChatRepository.getMembership(
      conversation_id,
      user_id,
    );

    if (!membership || membership.role !== 'ADMIN') {
      throw new ForbiddenException('You are not admin of this conversation');
    }

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

  async updateConversationSilent(
    conversation_id: string,
    user_id: string,
    body: UpdateConversationSilentDto,
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first!');

    const membership = await ChatRepository.getMembership(
      conversation_id,
      user_id,
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    let mutedUntil: Date | null = null;

    if (body.mode === ConversationSilentMode.FOREVER) {
      mutedUntil = FOREVER_MUTE_UNTIL;
    } else if (body.mode === ConversationSilentMode.UNTIL) {
      mutedUntil = new Date(body.until_at as string);
      if (Number.isNaN(mutedUntil.getTime()) || mutedUntil <= new Date()) {
        throw new BadRequestException('until_at must be a future date');
      }
    }

    const updatedMembership = await this.prisma.membership.update({
      where: {
        id: membership.id,
      },
      data: {
        muted_until: mutedUntil,
      },
      select: {
        conversation_id: true,
        muted_until: true,
      },
    });

    const silentState = normalizeConversationSilentState(
      updatedMembership.muted_until,
    );

    return {
      success: true,
      message: 'Conversation silent preference updated successfully',
      data: {
        conversation_id: updatedMembership.conversation_id,
        is_silenced: silentState.is_silenced,
        mode: silentState.mode,
        muted_until: silentState.muted_until,
      },
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
      where.AND = [
        { type: { notIn: ['IMAGE', 'VIDEO', 'AUDIO'] } },
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

  async reportUser(
    reporter_id: string,
    reported_id: string,
    body: CreateUserReportDto,
  ) {
    if (!reporter_id) throw new UnauthorizedException('Please login first!');
    if (!reported_id)
      throw new BadRequestException('Reported user id is required');

    if (reporter_id === reported_id) {
      throw new BadRequestException('You cannot report yourself');
    }

    const reportedUser = await this.prisma.user.findUnique({
      where: {
        id: reported_id,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!reportedUser) {
      throw new BadRequestException('Reported user not found');
    }

    await this.prisma.report.create({
      data: {
        reporter_id,
        reported_user_id: reported_id,
        reason: body.reason?.trim() || 'No reason provided',
      },
    });

    return {
      success: true,
      message: 'User reported successfully',
    };
  }
}
