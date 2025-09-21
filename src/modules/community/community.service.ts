import { Injectable, Post } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { id } from 'date-fns/locale';
import { SazedStorage } from 'src/common/lib/disk/SazedStorage';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { StringHelper } from 'src/common/helper/string.helper';
import appConfig from 'src/config/app.config';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  async createPost(
    authorId: string,
    content: string,
    mediaType?: 'PHOTO' | 'VIDEO',
    visibility: 'PUBLIC' | 'PRIVATE' | 'FRIENDS' = 'PUBLIC',
    file?: Express.Multer.File,
  ) {
    if (authorId === null || authorId === undefined || authorId === '') {
      return { success: false, message: 'Author ID is required' };
    }

    let mediaUrl: string | undefined = undefined;

    // if (file) {
    //   // Ensure uploads directory exists
    //   const uploadDir = join(process.cwd(), 'public', 'storage', 'community');
    //   mkdirSync(uploadDir, { recursive: true });

    //   // Save file
    //   const fileName = `${Date.now()}_${file.originalname}`;
    //   const filePath = join(uploadDir, fileName);
    //   writeFileSync(filePath, file.buffer);

    //   // Set mediaUrl to public path
    //   mediaUrl = `http://localhost:${process.env.PORT}/storage/community/${fileName}`;
    // }

    // upload file to S3 or MinIO
    if (file) {
      const filename = `${StringHelper.randomString(10)}_${file.originalname}`;

      if (mediaType === 'PHOTO') {
        await SazedStorage.put(
          appConfig().storageUrl.communityPhoto + `/${filename}`,
          file.buffer,
        );

        mediaUrl =
          process.env.AWS_S3_ENDPOINT +
          '/' +
          process.env.AWS_S3_BUCKET +
          appConfig().storageUrl.communityPhoto +
          `/${filename}`;
      } else if (mediaType === 'VIDEO') {
        await SazedStorage.put(
          appConfig().storageUrl.communityVideo + `/${filename}`,
          file.buffer,
        );

        mediaUrl =
          process.env.AWS_S3_ENDPOINT +
          '/' +
          process.env.AWS_S3_BUCKET +
          appConfig().storageUrl.communityVideo +
          `/${filename}`;
      }
    }

    return this.prisma.communityPost.create({
      data: {
        author_Id: authorId,
        content,
        media_Url: mediaUrl,
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

  async updatePost(
    postId: string,
    userId: string,
    dto: any,
    mediaType?: 'PHOTO' | 'VIDEO',
    visibility: 'PUBLIC' | 'PRIVATE' | 'FRIENDS' = 'PUBLIC',
    file?: Express.Multer.File,
  ) {
    try {
      let mediaUrl: string | undefined = undefined;

      if (file) {
        const oldfile = await this.prisma.communityPost.findUnique({
          where: { id: postId },
          select: { media_Url: true },
        });

        // delete old file from s3 or minio
        if (oldfile?.media_Url) {
          const urlParts = oldfile.media_Url.split('/');
          const key = urlParts.slice(3).join('/'); // Adjust index based on your URL structure
          await SazedStorage.delete(key);
        }

        // upload new file to s3 or minio
        const filename = `${StringHelper.randomString(10)}_${file.originalname}`;

        if (mediaType === 'PHOTO') {
          await SazedStorage.put(
            appConfig().storageUrl.communityPhoto + `/${filename}`,
            file.buffer,
          );

          mediaUrl =
            process.env.AWS_S3_ENDPOINT +
            '/' +
            process.env.AWS_S3_BUCKET +
            appConfig().storageUrl.communityPhoto +
            `/${filename}`;
        } else if (mediaType === 'VIDEO') {
          await SazedStorage.put(
            appConfig().storageUrl.communityVideo + `/${filename}`,
            file.buffer,
          );

          mediaUrl =
            process.env.AWS_S3_ENDPOINT +
            '/' +
            process.env.AWS_S3_BUCKET +
            appConfig().storageUrl.communityVideo +
            `/${filename}`;
        }
      }

      const post = await this.prisma.communityPost.findUnique({
        where: { id: postId },
      });

      if (!post) {
        return { success: false, message: 'Post not found' };
      }

      if (post.author_Id !== userId) {
        return { success: false, message: 'Unauthorized' };
      }
      // update post
      await this.prisma.communityPost.update({
        where: { id: postId },
        data: {
          content: dto.content,
          media_Url: mediaUrl,
          mediaType,
          visibility,
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

  //   {
  //   "content": "Final testing from Updateding post",
  //   "mediaUrl": "https://example.com/media/photo.jpg",
  //   "mediaType": "PHOTO",
  //   "visibility": "PUBLIC"
  // }

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
          success: false,
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
  // Add a comment to a post
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

  // Like a comment or reply (toggle)
  async likeCommentOrReply(commentId: string, userId: string) {
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

      // Ensure the comment or reply exists
      const comment = await this.prisma.communityComment.findFirst({
        where: { id: commentId },
        select: { id: true },
      });

      if (!comment) {
        return { success: false, message: 'Comment or reply not found' };
      }

      // Create the like for the comment or reply
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

      return { liked: true, message: 'Like added successfully' }; // Return success message
    }
  }

  async replyToCommentOrReply(
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
        name: user.name,
        username: user.username,
        avatar: user.avatar,
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
        likes: { select: { id: true } }, // Fetch likes for the main comment
        replies: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatar: true },
            },
            likes: { select: { id: true } }, // Fetch likes for the replies
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Return formatted data with like counts
    return comments.map((comment) => ({
      ...comment,
      likeCount: comment.likes.length, // Count likes for the comment
      replies: comment.replies.map((reply) => ({
        ...reply,
        likeCount: reply.likes.length, // Count likes for the reply
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
      // Ensure the user exists
      const existing = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!existing) {
        return { success: false, message: 'User not found' };
      }

      // Build partial update payload to avoid overwriting with undefined
      const data: any = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.username !== undefined) data.username = dto.username;
      if (dto.email !== undefined) data.email = dto.email;
      if (dto.avatar !== undefined) data.avatar = dto.avatar;
      if (dto.about !== undefined) data.about = dto.about;

      await this.prisma.user.update({ where: { id: userId }, data });

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
