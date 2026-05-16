import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryCommunityDto } from './dto/query-community.dto';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';

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
      where.author = {
        role_users: {
          some: {
            role: {
              name: {
                contains: role,
                mode: 'insensitive',
              },
            },
          },
        },
      };
    }

    const posts = await this.prisma.communityPost.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        content: true,
        status: true,
        created_at: true,
        updated_at: true,
        author: {
          select: {
            id: true,
            name: true,
            role_users: { select: { role: true } },
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
              ? post.author.avatar.startsWith('http')
                ? post.author.avatar
                : SazedStorage.url(
                  `${appConfig().storageUrl.avatar.replace(/\/+$/, '')}/${String(post.author.avatar).replace(/^\/+/, '')}`,
                )
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

  async getAllRequestedPost(userId: string, query: QueryCommunityDto) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }
      const { page, limit, search } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.CommunityPostWhereInput = {
        status: 'REQUEST',
      };

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

      const posts = await this.prisma.communityPost.findMany({
        where,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          content: true,
          status: true,
          created_at: true,
          updated_at: true,
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role_users: { select: { role: true } },
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
        data: posts.map((post) => ({
          ...post,
          author: {
            ...post.author,
            avatar: post.author.avatar
              ? post.author.avatar.startsWith('http')
                ? post.author.avatar
                : SazedStorage.url(
                  `${appConfig().storageUrl.avatar.replace(/\/+$/, '')}/${String(post.author.avatar).replace(/^\/+/, '')}`,
                )
              : null,
          },
        })),
        meta_data: {
          page,
          limit,
          total,
          search,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching posts',
      };
    }
  }

  async getPostById(userId: string, postId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const post = await this.prisma.communityPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          content: true,
          status: true,
          created_at: true,
          updated_at: true,
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role_users: { select: { role: true } },
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

      if (!post) {
        return {
          success: false,
          message: 'Post not found',
        };
      }

      const formatPost = {
        ...post,
        author: {
          ...post.author,
          avatar: post.author.avatar
            ? post.author.avatar.startsWith('http')
              ? post.author.avatar
              : SazedStorage.url(
                `${appConfig().storageUrl.avatar.replace(/\/+$/, '')}/${String(post.author.avatar).replace(/^\/+/, '')}`,
              )
            : null,
        },
        comments: post._count.comments,
        likes: post._count.likes,
      };
      delete formatPost._count;

      return {
        success: true,
        data: formatPost,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching post',
      };
    }
  }

  async approvePost(userId: string, postId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const post = await this.prisma.communityPost.update({
        where: { id: postId },
        data: { status: 'APPROVED' },
      });
      return { success: true, data: post };
    } catch (error) {
      return {
        success: false,
        message: 'Error approving post',
      };
    }
  }

  async rejectPost(userId: string, postId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const post = await this.prisma.communityPost.update({
        where: { id: postId },
        data: { status: 'REJECTED' },
      });
      return { success: true, data: post };
    } catch (error) {
      return {
        success: false,
        message: 'Error rejecting post',
      };
    }
  }

  async flagUnflagPost(userId: string, postId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }
      const existing = await this.prisma.communityPost.findUnique({
        where: { id: postId },
        select: { id: true, status: true },
      });

      if (!existing) {
        return { success: false, message: 'Post not found' };
      }

      const nextStatus: PostStatus =
        existing.status === 'FLAGGED' ? 'APPROVED' : 'FLAGGED';

      const post = await this.prisma.communityPost.update({
        where: { id: postId },
        data: { status: nextStatus },
        select: { id: true, status: true },
      });

      return {
        success: true,
        message: nextStatus === 'FLAGGED' ? 'Post flagged' : 'Post unflagged',
        data: post,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error toggling flag on post',
      };
    }
  }

  async deletePost(userId: string, postId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const post = await this.prisma.communityPost.delete({
        where: { id: postId },
      });
      return { success: true, data: post };
    } catch (error) {
      return {
        success: false,
        message: 'Error deleting post',
      };
    }
  }
}
