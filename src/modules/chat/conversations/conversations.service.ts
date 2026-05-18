import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConversationType, MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { extname } from 'path';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationQueryDto } from './dto/query-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
  ) { }


  async createConversation(user_id: string, createConversationDto: CreateConversationDto, group_avatar?: Express.Multer.File) {

    if (!user_id) throw new UnauthorizedException('Please login first!')
    const { type, participant_id, participant_ids, title } = createConversationDto

    if (participant_id === user_id || participant_ids?.includes(user_id)) throw new BadRequestException('Invalid participants!')

    const where: Prisma.ConversationWhereInput = {
      type,
    }

    if (type === ConversationType.DM) {
      if (!participant_id) throw new BadRequestException('Participant id is required for DM')
      where.memberships = {
        some: {
          AND: [
            { user_id: user_id },
            { user_id: participant_id }
          ]
        }
      }
    }
    let avatar: string;
    if (type === ConversationType.GROUP) {
      if (!title) throw new BadRequestException('Title is required for GROUP')
      if (!participant_ids || participant_ids.length < 1) throw new BadRequestException('Participant ids is required for GROUP and must be more than 1')
      where.title = { equals: title }
      if (group_avatar) {
        try {
          const filename = NajimStorage.generateFileName(group_avatar.originalname)
          const objectKey = appConfig().storageUrl.conversation_avatar + '/' + filename
          await NajimStorage.put(objectKey, group_avatar)
          avatar = objectKey
        } catch (error) {
          throw new BadRequestException('Failed to upload group avatar')
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
            memberships: true
          }
        }
      }
    })
    const existCount = existConversation?._count?.memberships
    delete existConversation?._count
    existConversation.avatar = existConversation.avatar ? NajimStorage.url(existConversation.avatar) : null
    if (existConversation) return {
      success: true,
      message: 'Conversation already exists',
      data: { ...existConversation, total_members: existCount }
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
            ...(participant_id ? [{ user_id: participant_id }] : participant_ids?.length > 0 ? participant_ids?.map((id) => ({ user_id: id })) : []),
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
            memberships: true
          }
        }
      }
    });

    const count = conversation._count.memberships
    delete conversation._count
    conversation.avatar = conversation.avatar ? NajimStorage.url(conversation.avatar) : null
    return {
      success: true,
      message: 'Conversation created successfully',
      data: { ...conversation, total_members: count, }
    }
  }



  async getMyConversations(user_id: string, query: ConversationQueryDto) {
    const { cursor, limit, type } = query

    const where: Prisma.ConversationWhereInput = {
      memberships: {
        some: {
          user_id: user_id
        }
      }
    }
    if (type) where.type = type

    const conversations = await this.prisma.conversation.findMany({
      where,
      select: {
        id: true,
        title: true,
        avatar: true,
        type: true,
        memberships: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true
              }
            }
          },
          where: {
            user_id: {
              not: user_id
            }
          },
          take: 1,
        },
        _count: {
          select: {
            memberships: true,
            messages: {
              where: {
                read_at: null
              }
            }
          }
        }
      },
      take: limit,
      cursor: cursor ? {
        id: cursor
      } : undefined,
    })
    return {
      success: true,
      message: 'Conversations fetched successfully',
      data: conversations.map((conversation) => {
        const other_member = conversation.memberships[0]
        const { memberships: total_members, messages: unread_messages } = conversation._count
        delete conversation.memberships
        delete conversation._count
        conversation.avatar = conversation.avatar ? NajimStorage.url(conversation.avatar) : other_member?.user?.avatar ? NajimStorage.url(other_member?.user?.avatar) : null
        return {
          ...conversation,
          total_members,
          unread_messages,
          participant: other_member?.user ?? null,
        }
      })
    }
  }

  // mark read up to now or specific timestamp
  async markRead(conversation_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException('Please login first!')
    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: conversation_id
      }
    })
    if (!conversation) throw new BadRequestException('Conversation not found')

    const membership = await this.prisma.membership.findFirst({
      where: {
        conversation_id: conversation_id,
        user_id: user_id
      }
    })
    if (!membership) throw new ForbiddenException('Not a member of this conversation')

    const last_read_at = new Date()
    await this.prisma.membership.update({
      where: {
        id: membership.id
      },
      data: {
        last_read_at: last_read_at,
      }
    })
  }

  // ---- member management ----
  async addMembers(
    conversationId: string,
    currentUserId: string,
    memberIds: string[],
  ) {


    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid user IDs: ${invalidIds.join(', ')}`,
      );
    }

    const unique = validIds;

    const existing = await this.prisma.membership.findMany({
      where: {
        conversation_id: conversationId,
        user_id: { in: unique },
      },
      select: { user_id: true },
    });
    const existingIds = new Set(existing.map((m) => m.user_id));

    const toAdd = unique.filter((uid) => !existingIds.has(uid));
    if (toAdd.length === 0) {
      return { ok: false, message: 'All members already exist' };
    }

    await this.prisma.membership.createMany({
      data: toAdd.map((uid) => ({
        conversation_id: conversationId,
        user_id: uid,
        role: 'MEMBER',
        last_read_at: new Date(),
      })),
      skipDuplicates: true,
    });
    return { ok: true, added: toAdd };
  }

  // list members of a group conversation
  // optionally filter by role (ADMIN or MEMBER)
  async getGroupMembers(
    conversationId: string,
    currentUserId: string,
    role?: MemberRole,
  ) {

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    });
    if (!conv || conv.type !== ConversationType.GROUP) {
      throw new BadRequestException(
        'Members list is available only for group conversations',
      );
    }

    const members = await this.prisma.membership.findMany({
      where: {
        conversation_id: conversationId,
        ...(role ? { role } : {}),
      },
      select: {
        user_id: true,
        role: true,
        user: { select: { name: true, username: true, avatar: true } },
      },
      orderBy: [{ role: 'desc' }, { joined_at: 'asc' }],
    });

    return members.map((m) => ({
      userId: m.user_id,
      displayName: m.user.name,
      username: m.user.username,
      avatarUrl: this.resolveAvatarUrl(m.user.avatar),
      isCurrentUser: m.user_id === currentUserId,
      role: m.role,
    }));
  }

  // change role of a member (admin only)
  async removeMember(
    conversationId: string,
    currentUserId: string,
    targetUserId: string,
  ) {
    await this.prisma.membership.deleteMany({
      where: { conversation_id: conversationId, user_id: targetUserId },
    });
    return { ok: true };
  }

  // change role of a member (admin only)
  async setRole(
    conversationId: string,
    currentUserId: string,
    targetUserId: string,
    role: MemberRole,
  ) {
    await this.prisma.membership.updateMany({
      where: { conversation_id: conversationId, user_id: targetUserId },
      data: { role },
    });
    return { ok: true };
  }

  //------ clear conversation for me----

  async clearForUser(conversationId: string, userId: string, upTo?: Date) {

    const at = upTo ?? new Date();

    await this.prisma.membership.updateMany({
      where: { conversation_id: conversationId, user_id: userId },
      data: { cleared_at: at, last_read_at: at },
    });

    return { ok: true, conversationId, clearedAt: at.toISOString() };
  }
}
