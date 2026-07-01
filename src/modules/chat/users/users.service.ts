import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import { UserStatus } from 'src/common/constants/user-status.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryDiscoverUsersDto } from './dto/query-user.dto';

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

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // async suggestUsers(currentUserId: string, q: string, take = 10) {
  //   const term = (q ?? '').trim();
  //   if (term.length < 2) return { items: [] };

  //   const users = await this.prisma.user.findMany({
  //     where: {
  //       deleted_at: null,
  //       id: { not: currentUserId },
  //       AND: [
  //         { blocks_initiated: { none: { blockedId: currentUserId } } },
  //         { blocked_by: { none: { blockerId: currentUserId } } },
  //       ],
  //       OR: [
  //         { name: { contains: term, mode: 'insensitive' } },
  //         { username: { contains: term, mode: 'insensitive' } },
  //         { email: { startsWith: term, mode: 'insensitive' } },
  //       ],
  //     },
  //     select: {
  //       id: true,
  //       name: true,
  //       username: true,
  //       avatar: true,
  //     },
  //     take,
  //     orderBy: [{ name: 'asc' }],
  //   });

  //   // console.log('Suggested users:', users);

  //   const items = users.map((u) => ({
  //     id: u.id,
  //     name: u.name ?? 'Unknown',
  //     username: u.username ?? null,
  //     avatar_url: u.avatar
  //       ? /^https?:\/\//i.test(String(u.avatar))
  //         ? String(u.avatar)
  //         : NajimStorage.url(
  //             `${appConfig().storageUrl.avatar.replace(/^\/+/, '').replace(/\/+$/, '')}/${String(u.avatar).replace(/^\/+/, '')}`,
  //           )
  //       : null,
  //   }));

  //   // console.log('Final items:', items);

  //   return { items };
  // }

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

    const lowerSearch = normalizedSearch?.toLowerCase() ?? null;

    const similarityExpression = normalizedSearch
      ? Prisma.sql`
          (
            CASE
              WHEN LOWER(COALESCE(u.username, '')) = ${lowerSearch} THEN 5000000
              WHEN LOWER(COALESCE(u.name, '')) = ${lowerSearch} THEN 4500000
              WHEN LOWER(COALESCE(u.email, '')) = ${lowerSearch} THEN 4500000
              WHEN COALESCE(u.phone_number, '') = ${normalizedSearch} THEN 4500000
              WHEN COALESCE(u.username, '') ILIKE ${`${normalizedSearch}%`} THEN 3500000
              WHEN COALESCE(u.name, '') ILIKE ${`${normalizedSearch}%`} THEN 3200000
              WHEN COALESCE(u.email, '') ILIKE ${`${normalizedSearch}%`} THEN 3200000
              WHEN COALESCE(u.phone_number, '') LIKE ${`${normalizedSearch}%`} THEN 3200000
              ELSE 0
            END
            +
            FLOOR(
              GREATEST(
                similarity(COALESCE(u.name, ''), ${normalizedSearch}),
                similarity(COALESCE(u.username, ''), ${normalizedSearch}),
                similarity(COALESCE(u.email, ''), ${normalizedSearch}),
                similarity(COALESCE(u.phone_number, ''), ${normalizedSearch})
              ) * 1000000
            )::integer
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
      type === 'student'
        ? Prisma.sql`
            AND (
              LOWER(COALESCE(u.type, '')) = 'student'
              OR EXISTS (
                SELECT 1
                FROM role_users ru
                INNER JOIN roles r ON r.id = ru.role_id
                WHERE ru.user_id = u.id
                  AND LOWER(COALESCE(r.name, '')) = 'student'
              )
            )
          `
        : type === 'admin'
          ? Prisma.sql`
            AND (
              LOWER(COALESCE(u.type, '')) = 'admin'
              OR EXISTS (
                SELECT 1
                FROM role_users ru
                INNER JOIN roles r ON r.id = ru.role_id
                WHERE ru.user_id = u.id
                  AND LOWER(COALESCE(r.name, '')) = 'admin'
              )
            )
          `
          : type === 'teacher'
            ? Prisma.sql`
              AND (
                LOWER(COALESCE(u.type, '')) = 'teacher'
                OR EXISTS (
                  SELECT 1
                  FROM role_users ru
                  INNER JOIN roles r ON r.id = ru.role_id
                  WHERE ru.user_id = u.id
                    AND LOWER(COALESCE(r.name, '')) = 'teacher'
                )
              )
            `
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
        SELECT
          LOWER(COALESCE(u.type, '')) AS normalized_type,
          EXISTS (
            SELECT 1
            FROM role_users ru
            INNER JOIN roles r ON r.id = ru.role_id
            WHERE ru.user_id = u.id
              AND LOWER(COALESCE(r.name, '')) = 'admin'
          ) AS has_admin_role
        FROM users u
        WHERE u.id = ${user_id}
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
              FROM community_likes community_like
              INNER JOIN community_posts community_post
                ON community_post.id = community_like.post_id
              WHERE community_post.author_id = ${user_id}
                AND community_like.user_id = u.id
            )
            OR EXISTS (
              SELECT 1
              FROM community_comments community_comment
              INNER JOIN community_posts community_post
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
              INNER JOIN community_posts community_post
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
            LOWER(COALESCE(u.type, '')) IN ('user', 'student', 'teacher', 'admin')
            OR EXISTS (
              SELECT 1
              FROM role_users ru
              INNER JOIN roles r ON r.id = ru.role_id
              WHERE ru.user_id = u.id
                AND LOWER(COALESCE(r.name, '')) IN ('user', 'student', 'teacher', 'admin')
            )
            OR (
              (
                LOWER(COALESCE(u.type, '')) = 'su_admin'
                OR EXISTS (
                  SELECT 1
                  FROM role_users ru
                  INNER JOIN roles r ON r.id = ru.role_id
                  WHERE ru.user_id = u.id
                    AND LOWER(COALESCE(r.name, '')) = 'su_admin'
                )
              )
              AND (
                cu.normalized_type = 'admin'
                OR cu.has_admin_role = true
              )
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

  async block(blockerId: string, targetUserId: string) {
    if (blockerId === targetUserId) {
      throw new ForbiddenException('Cannot block yourself');
    }

    await this.prisma.block.upsert({
      where: {
        blocker_id_blocked_id: {
          blocker_id: blockerId,
          blocked_id: targetUserId,
        },
      },
      update: {},
      create: {
        blocker_id: blockerId,
        blocked_id: targetUserId,
      },
    });

    return {
      success: true,
      message: 'User blocked successfully',
    };
  }

  async unblock(blockerId: string, targetUserId: string) {
    await this.prisma.block.deleteMany({
      where: {
        blocker_id: blockerId,
        blocked_id: targetUserId,
      },
    });

    return {
      success: true,
      message: 'User unblocked successfully',
    };
  }

  async getBlockStatus(currentUserId: string, targetUserId: string) {
    const [blockedByMe, blockedMe] = await Promise.all([
      this.prisma.block.count({
        where: {
          blocker_id: currentUserId,
          blocked_id: targetUserId,
        },
      }),
      this.prisma.block.count({
        where: {
          blocker_id: targetUserId,
          blocked_id: currentUserId,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        blocked_by_me: blockedByMe > 0,
        blocked_me: blockedMe > 0,
      },
    };
  }
}
