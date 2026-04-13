import { Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';
import { CreateCommunityManagementDto } from './dto/create-community-management.dto';
import { UpdateCommunityManagementDto } from './dto/update-community-management.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetPostsQueryDto } from './dto/query-community-management.dto';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class CommunityManagementService {
  constructor(private prisma: PrismaService) {}

  async create(createCommunityManagementDto: CreateCommunityManagementDto) {
    // return this.prisma.communityPost.create({
    //   data: createCommunityManagementDto,
    // });
  }

  async getAllPosts(userId: string, query: GetPostsQueryDto) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
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
      } else {
        where.status = {
          not: 'REQUEST',
        };
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
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          status: true,
          createdAt: true,
          updatedAt: true,
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
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching posts',
      };
    }
  }

  async getAllRequestedPost(userId: string, query: GetPostsQueryDto) {
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
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          status: true,
          createdAt: true,
          updatedAt: true,
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

  // async getAllPostsByStatus(userId: string, status: PostStatus) {
  //   try {
  //     if (!userId) {
  //       return {
  //         success: false,
  //         message: 'User ID is required',
  //       };
  //     }

  //     const posts = await this.prisma.communityPost.findMany({
  //       where: { status: status },
  //       orderBy: { createdAt: 'desc' },
  //       include: {
  //         author: {
  //           select: {
  //             id: true,
  //             name: true,
  //             role_users: { select: { role: true } },
  //             avatar: true,
  //           },
  //         },
  //         comments: { select: { id: true } },
  //         likes: { select: { id: true } },
  //       },
  //     });
  //     return { success: true, data: posts };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: 'Error fetching posts',
  //     };
  //   }
  // }

  // async getAllPostsByRole(userId: string, role: string) {
  //   try {
  //     if (!userId) {
  //       return {
  //         success: false,
  //         message: 'User ID is required',
  //       };
  //     }

  //     const posts = await this.prisma.communityPost.findMany({
  //       where: {
  //         author: {
  //           role_users: {
  //             some: {
  //               role: {
  //                 name: role,
  //               },
  //             },
  //           },
  //         },
  //       },
  //       orderBy: { createdAt: 'desc' },
  //       include: {
  //         author: {
  //           select: {
  //             id: true,
  //             name: true,
  //             role_users: { select: { role: true } },
  //             avatar: true,
  //           },
  //         },
  //         comments: { select: { id: true } },
  //         likes: { select: { id: true } },
  //       },
  //     });
  //     return { success: true, data: posts };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: 'Error fetching posts',
  //     };
  //   }
  // }

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
          createdAt: true,
          updatedAt: true,
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
