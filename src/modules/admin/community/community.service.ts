import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';
import { CreateCommunityDto } from './dto/create-community.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryCommunityDto } from './dto/query-community.dto';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) { }

  async create(createCommunityDto: CreateCommunityDto) {
    // return this.prisma.communityPost.create({
    //   data: createCommunityDto,
    // });
  }

  async getAllPosts(user_id: string, query: QueryCommunityDto) {
    if (!user_id) {
      throw new UnauthorizedException('You are not authorized to access this feature');
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
      where.author = role === 'ADMIN' ? {
        OR: [
          { type: { equals: 'admin' } },
          { type: { equals: 'su_admin' } },
        ]
      } : role === 'STUDENT' ? { type: { equals: 'student' } } : { type: { equals: 'user' } }
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

    if (!user_id) throw new UnauthorizedException("Unauthorized")

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
        poll_options: true,
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    if (!post) throw new BadRequestException("Post not found")

    const formatPost = {
      ...post,
      author: {
        ...post.author,
        avatar: post.author.avatar
          ? NajimStorage.url(post.author.avatar) : null,
      },
      comments: post._count.comments,
      likes: post._count.likes,
    };
    delete formatPost._count;

    return {
      success: true,
      message: "Post fetched successfully",
      data: formatPost,
    };

  }

  async changePostStatus(user_id: string, post_id: string, status: PostStatus) {
    if (!user_id) throw new UnauthorizedException("Unauthorized")
    if (!post_id) throw new BadRequestException("Post not found")

    const post = await this.prisma.communityPost.update({
      where: { id: post_id },
      data: { status },
    });

    if (!post) throw new BadRequestException("Post not found")

    return { success: true, message: "Post status changed successfully" };
  }

  async deletePost(user_id: string, post_id: string) {

    if (!user_id) throw new UnauthorizedException("Unauthorized")
    if (!post_id) throw new BadRequestException("Post not found")

    const post = await this.prisma.communityPost.delete({
      where: { id: post_id },
    });

    if (!post) throw new BadRequestException("Post not found")

    return { success: true, message: "Post deleted successfully" };

  }
}
