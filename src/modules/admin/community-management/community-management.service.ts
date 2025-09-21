import { Injectable } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { CreateCommunityManagementDto } from './dto/create-community-management.dto';
import { UpdateCommunityManagementDto } from './dto/update-community-management.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CommunityManagementService {
  constructor(private prisma: PrismaService) {}

  async create(createCommunityManagementDto: CreateCommunityManagementDto) {
    // return this.prisma.communityPost.create({
    //   data: createCommunityManagementDto,
    // });
  }

  async getAllPosts(userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const posts = await this.prisma.communityPost.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              role_users: { select: { role: true } },
              avatar: true,
            },
          },
          comments: { select: { id: true } },
          likes: { select: { id: true } },
        },
      });

      return {
        success: true,
        data: posts,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching posts',
      };
    }
  }

  async getAllRequestedPost(userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const posts = await this.prisma.communityPost.findMany({
        where: { status: 'REQUEST' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          media_Url: true,
          mediaType: true,
          visibility: true,
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
          comments: { select: { id: true } },
          likes: { select: { id: true } },
        },
      });
      return { success: true, data: posts };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching posts',
      };
    }
  }

  async getAllPostsByStatus(userId: string, status: PostStatus) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const posts = await this.prisma.communityPost.findMany({
        where: { status: status },
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              role_users: { select: { role: true } },
              avatar: true,
            },
          },
          comments: { select: { id: true } },
          likes: { select: { id: true } },
        },
      });
      return { success: true, data: posts };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching posts',
      };
    }
  }

  async getAllPostsByRole(userId: string, role: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const posts = await this.prisma.communityPost.findMany({
        where: {
          author: {
            role_users: {
              some: {
                role: {
                  name: role,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              role_users: { select: { role: true } },
              avatar: true,
            },
          },
          comments: { select: { id: true } },
          likes: { select: { id: true } },
        },
      });
      return { success: true, data: posts };
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
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role_users: { select: { role: true } },
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

      return {
        success: true,
        data: post,
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
