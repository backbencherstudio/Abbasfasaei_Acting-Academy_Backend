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
  QueryDiscoverUsersDto,
  QueryGroupMembersDto,
} from './dto/query-conversation.dto';

type DiscoverUsersCursorPayload = {
  shared_active_course: number;
  has_my_post_activity: number;
  similarity_rank: number;
  created_at: string;
  id: string;
  search_mode: boolean;
};

type DiscoverUsersRow = {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  type: string | null;
  created_at: Date;
  shared_active_course: number;
  has_my_post_activity: number;
  similarity_rank: number;
};

function encodeDiscoverUsersCursor(
  payload: DiscoverUsersCursorPayload,
): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeDiscoverUsersCursor(
  cursor?: string,
): DiscoverUsersCursorPayload | null {
  if (!cursor) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as DiscoverUsersCursorPayload;

    if (
      typeof payload?.id !== 'string' ||
      typeof payload?.created_at !== 'string' ||
      typeof payload?.shared_active_course !== 'number' ||
      typeof payload?.has_my_post_activity !== 'number' ||
      typeof payload?.similarity_rank !== 'number' ||
      typeof payload?.search_mode !== 'boolean'
    ) {
      throw new Error('Invalid cursor payload');
    }

    return payload;
  } catch {
    throw new BadRequestException('Invalid discover users cursor');
  }
}

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

    const membership = await ChatRepository.getMembership(
      conversation_id,
      user_id,
    );

    if (!membership || membership.role !== 'ADMIN') {
      throw new ForbiddenException('You are not admin of this conversation');
    }

    const newMembers = await this.prisma.membership.createMany({
      data: member_ids.map((member_id) => ({
        conversation_id,
        user_id: member_id,
        role: MemberRole.MEMBER,
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
    await ChatRepository.ensureMember(conversation_id, user_id);

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

    const total = await this.prisma.membership.count({
      where: {
        conversation_id,
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

  async discoverUsers(user_id: string, query: QueryDiscoverUsersDto) {
    if (!user_id) throw new UnauthorizedException('Please login first');
    const { cursor, limit, search, type } = query;
    const take = Math.min(Math.max(limit ?? 10, 1), 50);
    const normalizedSearch = search?.trim() || null;
    const isSearchMode = Boolean(normalizedSearch);
    const decodedCursor = decodeDiscoverUsersCursor(cursor);

    if (decodedCursor && decodedCursor.search_mode !== isSearchMode) {
      throw new BadRequestException(
        'Cursor search mode does not match current request',
      );
    }

    const similarityExpression = normalizedSearch
      ? Prisma.sql`
          FLOOR(
            GREATEST(
              similarity(COALESCE(u.name, ''), ${normalizedSearch}),
              similarity(COALESCE(u.username, ''), ${normalizedSearch})
            ) * 1000000
          )::integer
        `
      : Prisma.sql`0::integer`;

    const searchFilter = normalizedSearch
      ? Prisma.sql`
          AND (
            COALESCE(name, '') ILIKE ${`%${normalizedSearch}%`}
            OR COALESCE(username, '') ILIKE ${`%${normalizedSearch}%`}
            OR COALESCE(email, '') ILIKE ${`%${normalizedSearch}%`}
            OR COALESCE(phone_number, '') ILIKE ${`%${normalizedSearch}%`}
            OR similarity_rank > 100000
          )
        `
      : Prisma.empty;

    const typeFilter =
      type === 'admin'
        ? Prisma.sql`AND LOWER(COALESCE(u.type, '')) = 'admin'`
        : type === 'teacher'
          ? Prisma.sql`AND LOWER(COALESCE(u.type, '')) = 'teacher'`
          : Prisma.empty;

    const cursorFilter = decodedCursor
      ? decodedCursor.search_mode
        ? Prisma.sql`
            AND (
              shared_active_course < ${decodedCursor.shared_active_course}
              OR (
                shared_active_course = ${decodedCursor.shared_active_course}
                AND has_my_post_activity < ${decodedCursor.has_my_post_activity}
              )
              OR (
                shared_active_course = ${decodedCursor.shared_active_course}
                AND has_my_post_activity = ${decodedCursor.has_my_post_activity}
                AND similarity_rank < ${decodedCursor.similarity_rank}
              )
              OR (
                shared_active_course = ${decodedCursor.shared_active_course}
                AND has_my_post_activity = ${decodedCursor.has_my_post_activity}
                AND similarity_rank = ${decodedCursor.similarity_rank}
                AND created_at < ${new Date(decodedCursor.created_at)}
              )
              OR (
                shared_active_course = ${decodedCursor.shared_active_course}
                AND has_my_post_activity = ${decodedCursor.has_my_post_activity}
                AND similarity_rank = ${decodedCursor.similarity_rank}
                AND created_at = ${new Date(decodedCursor.created_at)}
                AND id < ${decodedCursor.id}
              )
            )
          `
        : Prisma.sql`
            AND (
              shared_active_course < ${decodedCursor.shared_active_course}
              OR (
                shared_active_course = ${decodedCursor.shared_active_course}
                AND has_my_post_activity < ${decodedCursor.has_my_post_activity}
              )
              OR (
                shared_active_course = ${decodedCursor.shared_active_course}
                AND has_my_post_activity = ${decodedCursor.has_my_post_activity}
                AND created_at < ${new Date(decodedCursor.created_at)}
              )
              OR (
                shared_active_course = ${decodedCursor.shared_active_course}
                AND has_my_post_activity = ${decodedCursor.has_my_post_activity}
                AND created_at = ${new Date(decodedCursor.created_at)}
                AND id < ${decodedCursor.id}
              )
            )
          `
      : Prisma.empty;

    const orderBy = isSearchMode
      ? Prisma.sql`
          ORDER BY
            shared_active_course DESC,
            has_my_post_activity DESC,
            similarity_rank DESC,
            created_at DESC,
            id DESC
        `
      : Prisma.sql`
          ORDER BY
            shared_active_course DESC,
            has_my_post_activity DESC,
            created_at DESC,
            id DESC
        `;

    const rows = await this.prisma.$queryRaw<DiscoverUsersRow[]>(Prisma.sql`
      WITH req_user AS (
        SELECT LOWER(COALESCE(type, '')) AS normalized_type
        FROM users
        WHERE id = ${user_id}
      ),
      ranked_users AS (
        SELECT
          u.id,
          u.name,
          u.username,
          u.email,
          u.phone_number,
          u.avatar,
          u.type,
          LOWER(COALESCE(u.type, '')) AS normalized_type,
          u.created_at,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM enrollments my_enrollment
              INNER JOIN enrollments candidate_enrollment
                ON candidate_enrollment.course_id = my_enrollment.course_id
              WHERE my_enrollment.user_id = ${user_id}
                AND candidate_enrollment.user_id = u.id
                AND my_enrollment.status = 'ACTIVE'
                AND candidate_enrollment.status = 'ACTIVE'
            )
            THEN 1
            ELSE 0
          END AS shared_active_course,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM "CommunityLike" community_like
              INNER JOIN "CommunityPost" community_post
                ON community_post.id = community_like.post_id
              WHERE community_post.author_id = ${user_id}
                AND community_like.user_id = u.id
            )
            OR EXISTS (
              SELECT 1
              FROM "CommunityComment" community_comment
              INNER JOIN "CommunityPost" community_post
                ON community_post.id = community_comment.post_id
              WHERE community_post.author_id = ${user_id}
                AND community_comment.user_id = u.id
                AND community_comment.deleted_at IS NULL
            )
            OR EXISTS (
              SELECT 1
              FROM community_poll_votes community_poll_vote
              INNER JOIN community_poll_options community_poll_option
                ON community_poll_option.id = community_poll_vote.option_id
              INNER JOIN "CommunityPost" community_post
                ON community_post.id = community_poll_option.post_id
              WHERE community_post.author_id = ${user_id}
                AND community_poll_vote.user_id = u.id
            )
            THEN 1
            ELSE 0
          END AS has_my_post_activity,
          ${similarityExpression} AS similarity_rank
        FROM users u
        CROSS JOIN req_user cu
        WHERE u.id <> ${user_id}
          AND u.deleted_at IS NULL
          AND u.status = ${UserStatus.ACTIVE}
          AND (
            LOWER(COALESCE(u.type, '')) IN ('student', 'teacher', 'admin')
            OR (
              LOWER(COALESCE(u.type, '')) = 'su_admin'
              AND cu.normalized_type = 'admin'
            )
          )
          ${typeFilter}
          AND NOT EXISTS (
            SELECT 1
            FROM blocks blocked_by_me
            WHERE blocked_by_me.blocker_id = ${user_id}
              AND blocked_by_me.blocked_id = u.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM blocks blocked_me
            WHERE blocked_me.blocker_id = u.id
              AND blocked_me.blocked_id = ${user_id}
          )
      )
      SELECT
        id,
        name,
        username,
        email,
        phone_number,
        avatar,
        type,
        created_at,
        shared_active_course,
        has_my_post_activity,
        similarity_rank
      FROM ranked_users
      WHERE 1 = 1
      ${searchFilter}
      ${cursorFilter}
      ${orderBy}
      LIMIT ${take + 1}
    `);

    const hasMore = rows.length > take;
    const pageRows = hasMore ? rows.slice(0, take) : rows;
    const lastRow = pageRows[pageRows.length - 1];

    return {
      success: true,
      message: 'Users discovered successfully',
      data: pageRows.map((user) => ({
        id: user.id,
        username: user.username ?? null,
        name: user.name ?? null,
        avatar: user.avatar ? NajimStorage.url(user.avatar) : null,
      })),
      meta_data: {
        limit: take,
        next_cursor:
          hasMore && lastRow
            ? encodeDiscoverUsersCursor({
                shared_active_course: Number(lastRow.shared_active_course),
                has_my_post_activity: Number(lastRow.has_my_post_activity),
                similarity_rank: Number(lastRow.similarity_rank ?? 0),
                created_at: lastRow.created_at.toISOString(),
                id: lastRow.id,
                search_mode: isSearchMode,
              })
            : null,
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

    await this.prisma.userReport.create({
      data: {
        reporter_id,
        reported_id,
        reason: body.reason?.trim() || 'No reason provided',
      },
    });

    return {
      success: true,
      message: 'User reported successfully',
    };
  }
}
