import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PostStatus, PostType, PostVisibility, Prisma } from '@prisma/client';
import { CreateCommunityDto } from './dto/create-community.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryCommunityDto } from './dto/query-community.dto';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { UpdateCommunityStatusDto } from './dto/update-community.dto';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  async create(
    user_id: string,
    dto: CreateCommunityDto,
    attachments?: Express.Multer.File[],
  ) {
    if (!user_id) throw new UnauthorizedException('user not found');

    const { post_type, poll_options, ...postData } = dto;

    const attachmentsData: Prisma.AttachmentCreateInput[] = [];

    for (const attachment of attachments ?? []) {
      try {
        const filename = NajimStorage.generateFileName(attachment.originalname);
        const objectKey = `${appConfig().storageUrl.community}/${filename}`;

        await NajimStorage.put(objectKey, attachment.buffer);

        attachmentsData.push({
          file_name: attachment.originalname,
          file_path: objectKey,
          type: attachment.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE',
          mime_type: attachment.mimetype,
          size_bytes: attachment.size,
        });
      } catch (error) {
        console.error(error);
      }
    }

    const pollOptions = poll_options?.map((option) => ({
      title: option,
    }));

    if (post_type === PostType.POLL && (pollOptions?.length ?? 0) < 2) {
      throw new BadRequestException('poll options are required');
    }

    const post = await this.prisma.communityPost.create({
      data: {
        author_id: user_id,
        ...postData,
        post_type,
        status: PostStatus.ANNOUNCEMENT,
        visibility: PostVisibility.PUBLIC,
        ...(post_type === PostType.POLL && {
          poll_options: { create: pollOptions },
        }),
        attachments: {
          create: attachmentsData,
        },
      },
    });

    if (!post) throw new InternalServerErrorException('error in create post');

    return {
      success: true,
      message: 'Post created successfully',
    };
  }

  async getAllPosts(user_id: string, query: QueryCommunityDto) {
    if (!user_id) {
      throw new UnauthorizedException(
        'You are not authorized to access this feature',
      );
    }
    const { page, limit, search, status, role } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CommunityPostWhereInput = {};

    if (search) {
      where.OR = [
        { content: { contains: query.search, mode: 'insensitive' } },
        {
          author: {
            name: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (status) {
      where.status = status;
    }
    if (role) {
      where.author =
        role === 'ADMIN'
          ? {
              OR: [
                { type: { equals: 'admin' } },
                { type: { equals: 'su_admin' } },
              ],
            }
          : role === 'STUDENT'
            ? { type: { equals: 'student' } }
            : { type: { equals: 'user' } };
    }

    const posts = await this.prisma.communityPost.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        content: true,
        status: true,
        created_at: true,
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            type: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
      skip,
      take: limit,
    });

    const total = await this.prisma.communityPost.count({ where });

    return {
      success: true,
      message: 'Posts fetched successfully',
      data: posts.map((post) => {
        const updatePost = {
          ...post,
          author: {
            ...post.author,
            avatar: post.author.avatar
              ? NajimStorage.url(post.author.avatar)
              : null,
          },
          comments: post._count.comments,
          likes: post._count.likes,
        };
        delete updatePost._count;
        return updatePost;
      }),
      meta_data: {
        page,
        limit,
        total,
        search,
        status,
        role,
      },
    };
  }

  async getPostById(user_id: string, post_id: string) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');

    const post = await this.prisma.communityPost.findUnique({
      where: { id: post_id },
      select: {
        id: true,
        content: true,
        status: true,
        created_at: true,
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            type: true,
            username: true,
          },
        },
        attachments: {
          select: {
            id: true,
            file_name: true,
            file_path: true,
            type: true,
            mime_type: true,
          },
        },
        poll_options: {
          select: {
            id: true,
            title: true,
            _count: {
              select: {
                votes: true,
              },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    if (!post) throw new BadRequestException('Post not found');

    const formatPost = {
      ...post,
      poll_options: post.poll_options.map((option) => {
        const count = option._count.votes;
        delete option._count;
        return {
          ...option,
          votes: count,
        };
      }),
      author: {
        ...post.author,
        avatar: post.author.avatar
          ? NajimStorage.url(post.author.avatar)
          : null,
      },
      attachments: post.attachments.map((attachment) => ({
        ...attachment,
        file_path: NajimStorage.url(attachment.file_path),
      })),
      comments: post._count.comments,
      likes: post._count.likes,
    };
    delete formatPost._count;

    return {
      success: true,
      message: 'Post fetched successfully',
      data: formatPost,
    };
  }

  async changePostStatus(
    user_id: string,
    post_id: string,
    updateCommunityStatusDto: UpdateCommunityStatusDto,
  ) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');
    if (!post_id) throw new BadRequestException('Post not found');
    const { status } = updateCommunityStatusDto;
    if (!status) throw new BadRequestException('Status is required');

    const post = await this.prisma.communityPost.update({
      where: { id: post_id },
      data: { status },
    });

    if (!post) throw new BadRequestException('Post not found');

    return { success: true, message: 'Post status changed successfully' };
  }

  async deletePost(user_id: string, post_id: string) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');
    if (!post_id) throw new BadRequestException('Post not found');

    const post = await this.prisma.communityPost.delete({
      where: { id: post_id },
    });

    if (!post) throw new BadRequestException('Post not found');

    return { success: true, message: 'Post deleted successfully' };
  }
}
