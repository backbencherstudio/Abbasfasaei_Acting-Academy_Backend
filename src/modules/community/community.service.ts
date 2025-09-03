import { Injectable, Post } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { id } from 'date-fns/locale';
import { SazedStorage } from 'src/common/lib/disk/SazedStorage';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  async createPost(
    authorId: string,
    content: string,
    mediaUrl?: string,
    mediaType?: 'PHOTO' | 'VIDEO',
    visibility: 'PUBLIC' | 'PRIVATE' | 'FRIENDS' = 'PUBLIC',
    file?: Express.Multer.File,
  ) {
    let storedMediaUrl = mediaUrl;

    if (file) {
      // Generate a unique key for the file
      const ext = file.originalname.split('.').pop();
      const key = `community/${Date.now()}_${authorId}.${ext}`;

      // Store file using SazedStorage (local or S3 based on config)
      await SazedStorage.put(key, file.buffer);

      // Get public URL for the file
      storedMediaUrl = SazedStorage.url(key);
    }

    

    return this.prisma.communityPost.create({
      data: {
        author_Id: authorId,
        content,
        media_Url: storedMediaUrl,
        mediaType,
        visibility,
      },
      select: {
        id: true,
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        content: true,
        media_Url: true,
        mediaType: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updatePost(postId: string, userId: string, dto: any) {
    try {
      const post = await this.prisma.communityPost.findUnique({
        where: { id: postId },
      });

      if (!post) {
        return { success: false, message: 'Post not found' };
      }

      if (post.author_Id !== userId) {
        return { success: false, message: 'Unauthorized' };
      }

      await this.prisma.communityPost.update({
        where: { id: postId },
        data: {
          content: dto.content,
          media_Url: dto.mediaUrl,
          mediaType: dto.mediaType,
          visibility: dto.visibility,
        },
      });

      return {
        success: true,
        message: 'Post updated successfully',
      };
    } catch (error) {
      throw new Error(error.message || 'Error updating post');
    }
  }

  async getFeed(userId: string) {
    const posts = await this.prisma.communityPost.findMany({
      where: {
        OR: [{ visibility: 'PUBLIC' }, { author_Id: userId }],
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        likes: true,
        comments: true,
        shares: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add counts for likes, comments, shares
    return posts.map((post) => ({
      ...post,
      likeCount: post.likes.length,
      commentCount: post.comments.length,
      shareCount: post.shares.length,
    }));
  }

  async likePost(postId: string, userId: string) {
    try {
      const existingLike = await this.prisma.communityLike.findFirst({
        where: { postId, userId },
      });

      if (existingLike) {
        await this.prisma.communityLike.delete({
          where: { id: existingLike.id },
        });

        return {
          liked: false,
          message: 'Post unliked successfully',
        };
      } else {
        // Fetch user details
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, username: true, avatar: true },
        });

        if (!user) {
          return { success: false, message: 'User not found' };
        }

        await this.prisma.communityLike.create({
          data: {
            postId,
            userId,
            name: user?.name,
            username: user?.username,
            avatar: user?.avatar,
            createdAt: new Date(),
          },
        });
        return {
          success: true,
          message: 'Post liked successfully',
        };
      }
    } catch (error) {
      throw new Error('Error toggling like');
    }
  }

  // get like count and users who liked a post
  async getLikes(postId: string) {
    const likes = await this.prisma.communityLike.findMany({
      where: { postId },
      select: {
        id: true,
        postId: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
    return { likes, likesCount: likes.length };
  }

  // async commentPost(postId: string, userId: string, content: string) {
  //   try {
  //     const user = await this.prisma.user.findUnique({
  //       where: { id: userId },
  //       select: { name: true, username: true, avatar: true },
  //     });

  //     if (!user) {
  //       throw new Error('User not found');
  //     }

  //     console.log('users', user);

  //     await this.prisma.communityComment.create({
  //       data: {
  //         postId,
  //         userId,
  //         name: user?.name,
  //         username: user?.username,
  //         avatar: user?.avatar,
  //         content,
  //       },
  //     });

  //     return {
  //       success: true,
  //       message: 'Comment added successfully',
  //     };
  //   } catch (error) {
  //     throw new Error('Error fetching user');
  //   }
  // }

  async commentPost(postId: string, userId: string, content: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, username: true, avatar: true },
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      await this.prisma.communityComment.create({
        data: {
          postId,
          userId,
          name: user.name,
          username: user.username ?? '',
          avatar: user.avatar ?? '',
          content,
        },
      });

      return {
        success: true,
        message: 'Comment added successfully',
      };
    } catch (error) {
      throw new Error(error.message || 'Error adding comment');
    }
  }

  // Like a comment (toggle)
  async likeComment(commentId: string, userId: string) {
    const existingLike = await this.prisma.communityCommentLike.findFirst({
      where: { commentId, userId },
    });

    if (existingLike) {
      await this.prisma.communityCommentLike.delete({
        where: { id: existingLike.id },
      });
      return { liked: false };
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          username: true,
          avatar: true,
        },
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      await this.prisma.communityCommentLike.create({
        data: {
          commentId,
          userId,
          name: user.name,
          username: user.username ?? '',
          avatar: user.avatar ?? '',
          createdAt: new Date(),
        },
      });
      return { liked: true, message: 'Like added successfully' };
    }
  }

  // Reply to a comment
  async replyComment(
    postId: string,
    parentId: string,
    userId: string,
    content: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true, avatar: true },
    });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    return this.prisma.communityComment.create({
      data: {
        postId,
        userId,
        parentId,
        name: user?.name,
        username: user?.username,
        avatar: user?.avatar,
        content,
        createdAt: new Date(),
      },
    });
  }

  // Get comments with replies and like count
  async getComments(postId: string) {
    const comments = await this.prisma.communityComment.findMany({
      where: { postId, parentId: null },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatar: true },
        },
        replies: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatar: true },
            },
            likes: true,
          },
        },
        likes: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add like counts
    return comments.map((comment) => ({
      ...comment,
      likeCount: comment.likes.length,
      replies: comment.replies.map((reply) => ({
        ...reply,
        likeCount: reply.likes.length,
      })),
    }));
  }

  async sharePost(postId: string, userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, username: true, avatar: true },
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      await this.prisma.communityShare.create({
        data: {
          postId,
          userId,
          name: user.name,
          username: user.username ?? '',
          avatar: user.avatar ?? '',
        },
      });

      return {
        success: true,
        message: 'Post shared successfully',
      };
    } catch (error) {
      throw new Error(error.message || 'Error sharing post');
    }
  }

  async deletePost(postId: string, userId: string) {
    try {
      const post = await this.prisma.communityPost.findUnique({
        where: { id: postId },
      });

      if (!post) {
        return { success: false, message: 'Post not found' };
      }

      if (post.author_Id !== userId) {
        return { success: false, message: 'Unauthorized' };
      }

      await this.prisma.communityPost.delete({
        where: { id: postId },
      });

      return {
        success: true,
        message: 'Post deleted successfully',
      };
    } catch (error) {
      throw new Error(error.message || 'Error deleting post');
    }
  }

  async getMyProfile(userId: string) {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          avatar: true,
          about: true,
        },
      });
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Error fetching user profile',
      };
    }
  }

  async editUserProfile(userId: string, dto: any) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: dto.name,
          username: dto.username,
          email: dto.email,
          avatar: dto.avatar,
          about: dto.about,
        },
      });

      return {
        success: true,
        message: 'User profile updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Error updating user profile',
      };
    }
  }

  async getUserProfile(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const userProfile = {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        about: user.about,
      };

      return {
        success: true,
        data: userProfile,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Error fetching user profile',
      };
    }
  }

  async reportUser(
    userId: string,
    reportedUserId: string,
    reason: string,
    description?: string,
  ) {
    try {
      const reportedUser = await this.prisma.user.findUnique({
        where: { id: reportedUserId },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          avatar: true,
        },
      });

      if (!reportedUser) {
        return { success: false, message: 'Reported user not found' };
      }

      if (userId === reportedUserId) {
        return { success: false, message: 'You cannot report yourself' };
      }

      // if user already reported then the user can't report again.
      const existingReport = await this.prisma.userReport.findFirst({
        where: {
          reporterId: userId,
          reportedUserId: reportedUserId,
        },
      });

      if (existingReport) {
        return {
          success: false,
          message: 'You have already reported this user',
        };
      }

      await this.prisma.userReport.create({
        data: {
          reporterId: userId,
          reportedUserId,
          reason,
          description,
          createdAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'User reported successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Error reporting user',
      };
    }
  }

  async getAllReports(userId: string) {
    try {
      const reports = await this.prisma.userReport.findMany({
        where: { reporterId: userId },
        include: {
          reportedUser: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      return {
        success: true,
        data: reports,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Error fetching all reports',
      };
    }
  }
}
