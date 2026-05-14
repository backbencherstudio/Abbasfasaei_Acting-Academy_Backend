import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import { StringHelper } from 'src/common/helper/string.helper';
import appConfig from 'src/config/app.config';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UserStatus } from 'src/common/constants/user-status.enum';
import { Prisma } from '@prisma/client';
import { EditProfileDto } from './dto/update-community-profile.dto';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  async createPost(
    userId: string,
    body: CreatePostDto,
    file?: Express.Multer.File,
  ) {
    // Determine author's platform role (ADMIN/TEACHER/STUDENT) via role_users
    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role_users: { select: { role: { select: { name: true } } } },
      },
    });

    if (!author) {
      return { success: false, message: 'Author not found' };
    }

    const roles = (author.role_users || [])
      .map((ru) => ru.role?.name)
      .filter(Boolean) as string[];
    const hasAdmin = roles.includes('ADMIN');
    const status: 'APPROVED' | 'REQUEST' = hasAdmin ? 'APPROVED' : 'REQUEST';

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
    if (body.postType === 'POST' && file) {
      const filename = `${StringHelper.randomString(10)}_${file.originalname}`;

      if (body.mediaType === 'PHOTO') {
        await SazedStorage.put(
          `${appConfig().storageUrl.communityPhoto.replace(/\/+$/, '')}/${filename}`,
          file.buffer,
        );

        mediaUrl = `${process.env.AWS_S3_ENDPOINT}/${process.env.AWS_S3_BUCKET}/${appConfig().storageUrl.communityPhoto.replace(/^\/+/, '')}/${filename}`;
      } else if (body.mediaType === 'VIDEO') {
        await SazedStorage.put(
          `${appConfig().storageUrl.communityVideo.replace(/\/+$/, '')}/${filename}`,
          file.buffer,
        );

        mediaUrl = `${process.env.AWS_S3_ENDPOINT}/${process.env.AWS_S3_BUCKET}/${appConfig().storageUrl.communityVideo.replace(/^\/+/, '')}/${filename}`;
      }
    }

    return this.prisma.communityPost.create({
      data: {
        author_id: author.id,
        content: body.content,
        visibility: body.visibility,
        post_type: body.postType as any,
        status: status as any, // Admin posts are approved immediately; others go to request queue
        poll_options:
          body.postType === 'POLL' && body.pollOptions
            ? {
                create: body.pollOptions.map((option) => ({
                  title: option,
                })),
              }
            : undefined,
        attachments: mediaUrl ? {
          create: {
            file_path: mediaUrl,
            type: body.mediaType as any,
          }
        } : undefined
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
        post_type: true,
        visibility: true,
        status: true,
        poll_options: true,
        created_at: true,
        updated_at: true,
        attachments: true,
      },
    });
  }

  async updatePost(
    postId: string,
    userId: string,
    body: UpdatePostDto,
    file?: Express.Multer.File,
  ) {
    try {
      // Determine updater's role to decide publishing status on update
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role_users: { select: { role: { select: { name: true } } } },
        },
      });

      const roles = (user?.role_users || [])
        .map((ru) => ru.role?.name)
        .filter(Boolean) as string[];
      const hasAdmin = roles.includes('ADMIN');

      const existingPost = await this.prisma.communityPost.findUnique({
        where: { id: postId },
        include: { poll_options: true, attachments: true },
      });

      if (!existingPost) {
        return { success: false, message: 'Post not found' };
      }

      if (existingPost.author_id !== userId) {
        return { success: false, message: 'Unauthorized' };
      }

      // Prevent post type switching
      if (
        body.postType &&
        body.postType !== (existingPost.post_type as unknown as string)
      ) {
        return { success: false, message: 'Cannot change post type' };
      }

      let mediaUrl = existingPost.attachments?.[0]?.file_path;

      // Only handle media updates for POST type
      if (existingPost.post_type === 'POST') {
        if (file) {
          // Delete old file from storage
          if (existingPost.attachments?.length > 0) {
            try {
              const oldPath = existingPost.attachments[0].file_path;
              const urlParts = oldPath.split('/');
              const key = urlParts.slice(3).join('/');
              await SazedStorage.delete(key);
            } catch (error) {
              console.error('Error deleting old media:', error);
            }
          }

          // Upload new file
          const filename = `${StringHelper.randomString(10)}_${file.originalname}`;
          const mediaType = body.mediaType || (existingPost.attachments?.[0]?.type as any);

          if (mediaType === 'PHOTO') {
            await SazedStorage.put(
              `${appConfig().storageUrl.communityPhoto.replace(/\/+$/, '')}/${filename}`,
              file.buffer,
            );
            mediaUrl = `${process.env.AWS_S3_ENDPOINT}/${process.env.AWS_S3_BUCKET}/${appConfig().storageUrl.communityPhoto.replace(/^\/+/, '')}/${filename}`;
          } else if (mediaType === 'VIDEO') {
            await SazedStorage.put(
              `${appConfig().storageUrl.communityVideo.replace(/\/+$/, '')}/${filename}`,
              file.buffer,
            );
            mediaUrl = `${process.env.AWS_S3_ENDPOINT}/${process.env.AWS_S3_BUCKET}/${appConfig().storageUrl.communityVideo.replace(/^\/+/, '')}/${filename}`;
          }
        }
      }

      // Handle poll options update only if requested for a POLL post
      let pollOptionsUpdate = undefined;
      if (existingPost.post_type === 'POLL' && body.pollOptions) {
        await this.prisma.communityPollOption.deleteMany({
          where: { post_id: postId },
        });
        pollOptionsUpdate = {
          create: body.pollOptions.map((option) => ({
            title: option,
          })),
        };
      }

      // Update the post with provided fields (partial update)
      await this.prisma.communityPost.update({
        where: { id: postId },
        data: {
          content: body.content !== undefined ? body.content : undefined,
          visibility:
            body.visibility !== undefined ? body.visibility : undefined,
          // Update status to REQUEST unless it's an admin edit
          status: hasAdmin ? 'APPROVED' : 'REQUEST',
          poll_options: pollOptionsUpdate,
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

  async getFeed(myId: string, userId?: string) {
    const where: Prisma.CommunityPostWhereInput = {
      OR: [
        // Show approved public posts from others WHO ARE ACTIVE
        {
          status: 'APPROVED',
          visibility: 'PUBLIC',
          author: { status: UserStatus.ACTIVE },
        },
      ],
    };
    if (userId) {
      where.author_id = userId;
    } else {
      where.OR.push({ author_id: myId });
    }
    const posts = await this.prisma.communityPost.findMany({
      where,
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
        poll_options: {
          include: {
            votes: true,
          },
        },
        attachments: true,
      },
      orderBy: { created_at: 'desc' },
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
        where: { post_id: postId, user_id: userId },
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
            post_id: postId,
            user_id: userId,
            created_at: new Date(),
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

  async voteOnAPoll(postId: string, optionId: string, userId: string) {
    const vote = await this.prisma.communityPollVote.findFirst({
      where: { user_id: userId, option: { post_id: postId } },
    });

    try {
      if (!vote) {
        await this.prisma.communityPollVote.create({
          data: { user_id: userId, option_id: optionId },
        });
        return { success: true, message: 'Voted successfully' };
      }

      if (vote.option_id === optionId) {
        await this.prisma.communityPollVote.delete({
          where: { id: vote.id },
        });
        return { success: true, message: 'Unvoted successfully' };
      }

      await this.prisma.communityPollVote.update({
        where: { id: vote.id },
        data: { option_id: optionId },
      });

      return { success: true, message: 'Voted successfully' };
    } catch {
      return {
        success: false,
        message:
          vote?.option_id === optionId
            ? 'Error unvoting on poll'
            : 'Error voting on poll',
      };
    }
  }
  // get like count and users who liked a post
  async getLikes(postId: string) {
    const likes = await this.prisma.communityLike.findMany({
      where: { post_id: postId },
      select: {
        id: true,
        post_id: true,
        created_at: true,
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
          post_id: postId,
          user_id: userId,
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
    const existingLike = await this.prisma.communityLike.findFirst({
      where: { comment_id: commentId, user_id: userId },
    });

    if (existingLike) {
      await this.prisma.communityLike.delete({
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
      await this.prisma.communityLike.create({
        data: {
          comment_id: commentId,
          user_id: userId,
          created_at: new Date(),
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

    // Validate parentId if provided
    if (parentId) {
      const parentComment = await this.prisma.communityComment.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!parentComment) {
        return {
          success: false,
          message: 'Parent comment or reply not found',
          error: 'INVALID_PARENT_ID',
        };
      }
    }

    return this.prisma.communityComment.create({
      data: {
        post_id: postId,
        user_id: userId,
        parent_id: parentId,
        content,
        created_at: new Date(),
      },
    });
  }

  // Get comments with replies and like count
  async getComments(postId: string) {
    const comments = await this.prisma.communityComment.findMany({
      where: {
        post_id: postId,
        parent_id: null,
        user: { status: 1 }, // Only show comments from active users
      },
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
          where: {
            user: { status: 1 }, // Only show replies from active users
          },
        },
      },
      orderBy: { created_at: 'desc' },
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
          post_id: postId,
          user_id: userId,
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

      if (post.author_id !== userId) {
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
      const profile = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          avatar: true,
          cover_image: true,
          about: true,
        },
      });

      if (profile.avatar) {
        // If avatar already contains an absolute URL, use it as-is; otherwise build via storage adapter
        const isAbsolute = /^https?:\/\//i.test(profile.avatar);
        const normalizedAvatar = String(profile.avatar).replace(/^\/+/, '');
        profile['avatar'] = isAbsolute
          ? profile.avatar
          : SazedStorage.url(this.avatarObjectKey(normalizedAvatar));
      }

      if (profile.cover_image) {
        // If avatar already contains an absolute URL, use it as-is; otherwise build via storage adapter
        const isAbsolute = /^https?:\/\//i.test(profile.cover_image);
        const normalizedAvatar = String(profile.cover_image).replace(
          /^\/+/,
          '',
        );
        profile['cover_image'] = isAbsolute
          ? profile.cover_image
          : SazedStorage.url(this.avatarObjectKey(normalizedAvatar));
      }
      return {
        success: true,
        message: 'Profile fetch successfully',
        data: {
          id: profile.id,
          name: profile.name,
          username: profile.username,
          email: profile.email,
          about: profile?.about,
          avatar: profile.avatar,
          cover_image: profile.cover_image,
        },
      };
    } catch (error) {
      throw new Error('Error fetching user profile');
    }
  }

  async editUserProfile(
    userId: string,
    dto: EditProfileDto,
    files?: {
      avatar?: Express.Multer.File[];
      cover_image?: Express.Multer.File[];
    },
  ) {
    try {
      const existing = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, avatar: true, cover_image: true },
      });

      if (!existing) return { success: false, message: 'User not found' };

      const data: Prisma.UserUpdateInput = {};

      // Update basic fields
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.username !== undefined) {
        const existing = await this.prisma.user.findUnique({
          where: { username: dto.username },
        });
        if (existing) {
          return { success: false, message: 'Username already exists' };
        }
        data.username = dto.username;
      }
      if (dto.about !== undefined) {
        data.about = dto.about;
      }

      // Handle file uploads with helper
      const uploadFile = async (
        file: Express.Multer.File,
        field: 'avatar' | 'cover_image',
        oldUrl?: string,
      ) => {
        const filename = `${StringHelper.randomString(10)}_${file.originalname}`;
        const path = `${appConfig().storageUrl.avatar.replace(/\/+$/, '')}/${filename}`;

        await SazedStorage.put(path, file.buffer);
        data[field] =
          `${process.env.AWS_S3_ENDPOINT}/${process.env.AWS_S3_BUCKET}${path}`;

        // Delete old file
        if (oldUrl) {
          try {
            const oldKey = oldUrl.split(process.env.AWS_S3_BUCKET)[1];
            if (oldKey) await SazedStorage.delete(oldKey);
          } catch (e) {
            console.error(`Error deleting old ${field}:`, e);
          }
        }
      };

      if (files?.avatar?.[0])
        await uploadFile(files.avatar[0], 'avatar', existing.avatar);
      if (files?.cover_image?.[0])
        await uploadFile(
          files.cover_image[0],
          'cover_image',
          existing.cover_image,
        );

      await this.prisma.user.update({ where: { id: userId }, data });

      return { success: true, message: 'User profile updated successfully' };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Error updating user profile',
      };
    }
  }
  private avatarObjectKey(fileName: string): string {
    const prefix = appConfig()
      .storageUrl.avatar.replace(/^\/+/, '')
      .replace(/\/+$/, '');
    const name = String(fileName || 'avatar')
      .trim()
      .replace(/^\/+/, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    return `${prefix}/${name}`;
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
      if (user.avatar) {
        // If avatar already contains an absolute URL, use it as-is; otherwise build via storage adapter
        const isAbsolute = /^https?:\/\//i.test(user.avatar);
        const normalizedAvatar = String(user.avatar).replace(/^\/+/, '');
        user['avatar'] = isAbsolute
          ? user.avatar
          : SazedStorage.url(this.avatarObjectKey(normalizedAvatar));
      }

      if (user.cover_image) {
        // If avatar already contains an absolute URL, use it as-is; otherwise build via storage adapter
        const isAbsolute = /^https?:\/\//i.test(user.cover_image);
        const normalizedAvatar = String(user.cover_image).replace(/^\/+/, '');
        user['cover_image'] = isAbsolute
          ? user.cover_image
          : SazedStorage.url(this.avatarObjectKey(normalizedAvatar));
      }

      const userProfile = {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        about: user?.about,
        cover_image: user.cover_image,
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
          reporter_id: userId,
          reported_id: reportedUserId,
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
          reporter_id: userId,
          reported_id: reportedUserId,
          reason,
          description,
          created_at: new Date(),
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
        where: { reporter_id: userId },
        include: {
          reported_user: {
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
