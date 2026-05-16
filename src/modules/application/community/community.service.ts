import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UserStatus } from 'src/common/constants/user-status.enum';
import { PostType, Prisma } from '@prisma/client';
import { QueryCommunityFeedDto, QueryCommunityPostLikesDto } from './dto/query-community.dto';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) { }

  async createPost(
    user_id: string,
    createPostDto: CreatePostDto,
    attachments?: Express.Multer.File[],
  ) {
    if (!user_id) throw new UnauthorizedException("user not found")

    const { post_type, friends_ids, poll_options, ...postData } = createPostDto;

    const attachmentsData: Prisma.AttachmentCreateInput[] = []

    for (const attachment of (attachments ?? [])) {
      try {
        const filename = SazedStorage.generateFileName(attachment.originalname)
        const objectKey = `${appConfig().storageUrl.community}/${filename}`

        await SazedStorage.put(objectKey, attachment.buffer)

        attachmentsData.push({
          file_name: attachment.originalname,
          file_path: objectKey,
          type: attachment.mimetype.startsWith('image/') ? 'IMAGE' : 'VIDEO',
          mime_type: attachment.mimetype,
          size_bytes: attachment.size,
        })

      } catch (error) {
        console.log(error);
      }
    }

    const pollOptions = poll_options?.map((option) => ({
      title: option,
    }))

    if (post_type === PostType.POLL && (pollOptions?.length ?? 0) < 2) {
      throw new BadRequestException("poll options are required")
    }

    const post = await this.prisma.communityPost.create({
      data: {
        author_id: user_id,
        ...postData,
        post_type,
        ...(post_type === PostType.POLL && { poll_options: { create: pollOptions } }),
        attachments: {
          create: attachmentsData
        },
        ...(friends_ids?.length > 0 && { allowed_friends: { connect: friends_ids.map(id => ({ id })) } })
      },
      select: {
        id: true,
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        content: true,
        post_type: true,
        visibility: true,
        allowed_friends: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        status: true,
        poll_options: true,
        attachments: {
          select: {
            file_path: true,
            type: true,
            mime_type: true,
          },
        },
      },
    });
    if (!post) throw new InternalServerErrorException('error in create post')
    return {
      success: true,
      message: 'Post created successfully',
      data: {
        ...post,
        author: {
          ...post.author,
          avatar: post.author.avatar ? SazedStorage.url(post.author.avatar) : null
        },
        allowed_friends: post.allowed_friends?.map(friend => ({
          ...friend,
          avatar: friend.avatar ? SazedStorage.url(friend.avatar) : null
        }))
      },
    }
  }

  async updatePost(
    post_id: string,
    user_id: string,
    updatePostDto: UpdatePostDto,
  ) {
    if (!user_id) throw new UnauthorizedException("user not found")
    if (!post_id) throw new BadRequestException("Invalid post id")

    const existingPost = await this.prisma.communityPost.findUnique({
      where: { id: post_id, author_id: user_id },
    });

    if (!existingPost) {
      throw new NotFoundException("post not found")
    }
    const { poll_options, post_type, friends_ids, ...postData } = updatePostDto
    if (
      post_type &&
      post_type !== existingPost.post_type
    ) {
      throw new ConflictException("Cannot change post type")
    }

    let pollOptionsUpdate = undefined;
    if (existingPost.post_type === PostType.POLL && poll_options) {
      await this.prisma.communityPollOption.deleteMany({
        where: { post_id: post_id },
      });

      pollOptionsUpdate = {
        create: poll_options.map((option) => ({
          title: option,
        })),
      };
    }

    const post = await this.prisma.communityPost.update({
      where: { id: post_id },
      data: {
        ...postData,
        ...(post_type === PostType.POLL && { poll_options: pollOptionsUpdate }),
        ...(friends_ids?.length > 0 && { allowed_friends: { set: friends_ids.map(id => ({ id })) } }),
      },
      select: {
        id: true,
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        content: true,
        post_type: true,
        visibility: true,
        allowed_friends: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        status: true,
        poll_options: true,
        attachments: {
          select: {
            file_path: true,
            type: true,
            mime_type: true,
          },
        },
      },
    });

    if (!post) throw new InternalServerErrorException('error in update post')

    return {
      success: true,
      message: 'Post updated successfully',
      data: {
        ...post,
        author: {
          ...post.author,
          avatar: post.author.avatar ? SazedStorage.url(post.author.avatar) : null
        },
        allowed_friends: post.allowed_friends?.map(friend => ({
          ...friend,
          avatar: friend.avatar ? SazedStorage.url(friend.avatar) : null
        }))
      },
    };

  }


  async deletePost(post_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException("user not found")
    if (!post_id) throw new BadRequestException("Invalid post id")

    const post = await this.prisma.communityPost.findUnique({
      where: { id: post_id, author_id: user_id },
    });

    if (!post) throw new NotFoundException("post not found")

    await this.prisma.communityPost.delete({
      where: { id: post_id },
    });

    return {
      success: true,
      message: 'Post deleted successfully',
    };

  }

  async getFeed(my_id: string, query: QueryCommunityFeedDto) {
    if (!my_id) throw new UnauthorizedException("user not found");

    const { user_id, search, cursor, limit } = query

    const where: Prisma.CommunityPostWhereInput = {
      OR: [
        {
          status: 'APPROVED',
          visibility: 'PUBLIC',
          author: { status: UserStatus.ACTIVE },
        },
      ],
    };

    if (search) {
      where.OR.push({
        content: { contains: search, mode: 'insensitive' },
        poll_options: {
          some: {
            title: { contains: search, mode: 'insensitive' },
          }
        }
      });
    }

    if (user_id) {
      where.author_id = user_id;
    } else {
      where.OR.push({ author_id: my_id });
    }

    const posts = await this.prisma.communityPost.findMany({
      where,
      select: {
        id: true,
        content: true,
        post_type: true,
        visibility: true,
        status: true,
        allowed_friends: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        poll_options: {
          select: {
            votes: {
              take: 4,
              orderBy: {
                created_at: 'desc'
              },
              select: {
                user: {
                  select: {
                    avatar: true,
                  }
                }
              }
            },
            _count: {
              select: {
                votes: true
              }
            }
          }
        },

        likes: {
          where: {
            user_id: my_id,
          },
          select: {
            id: true,
          },
        },

        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true
          }
        },

        attachments: {
          select: {
            file_path: true,
            type: true,
            mime_type: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      cursor: cursor ? { id: cursor } : undefined,
      take: limit + 1,
    });

    const nextCursor = posts.length > limit ? posts[posts.length - 1].id : null;
    if (posts.length > limit) posts.pop();

    return {
      success: true,
      message: 'Feed fetched successfully',
      data: posts.map((post) => {
        const { likes, comments, shares } = post?._count
        const is_liked = post.likes.length > 0;
        delete post._count;
        delete post.likes;

        return {
          ...post,
          is_liked,
          total_likes: likes,
          total_comments: comments,
          total_shares: shares,
          attachments: post.attachments.map((attachment) => ({
            ...attachment,
            file_path: attachment.file_path ? SazedStorage.url(attachment.file_path) : null,
          })),
          poll_options: post.poll_options.map((poll_option) => {
            const total_votes = poll_option._count.votes
            delete poll_option._count
            return {
              ...poll_option,
              total_votes,
              votes: poll_option.votes.map((vote) => ({
                ...vote,
                avatar: vote.user?.avatar ? SazedStorage.url(vote.user.avatar) : null,
              })),
            }
          })
        };
      }),
      meta_data: {
        limit,
        next_cursor: nextCursor,
        search,
        user_id
      },
    }
  }

  async getLikes(post_id: string, user_id: string, query: QueryCommunityPostLikesDto) {
    if (!user_id) throw new UnauthorizedException("user not found");
    if (!post_id) throw new BadRequestException("Invalid post id");

    const { cursor, limit } = query
    const where: Prisma.CommunityLikeWhereInput = {
      post_id: post_id,
      post: { status: 'APPROVED' },
    }
    const likes = await this.prisma.communityLike.findMany({
      where,
      select: {
        id: true,
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
      orderBy: { created_at: 'desc' },
      cursor: cursor ? { id: cursor } : undefined,
      take: limit + 1,
    });
    const nextCursor = likes.length > limit ? likes[likes.length - 1].id : null;
    if (likes.length > limit) likes.pop();
    return {
      success: true,
      message: 'Likes fetched successfully',
      data: likes.map((like) => {
        const user = like.user;
        delete like.user;
        return {
          ...like,
          user_id: user?.id,
          user_name: user?.name,
          user_username: user?.username,
          avatar: user?.avatar ? SazedStorage.url(user.avatar) : null,

        }
      }),
      meta_data: {
        limit,
        next_cursor: nextCursor,
      },
    }
  }

  async likePost(post_id: string, user_id: string) {

    const existingLike = await this.prisma.communityLike.findFirst({
      where: { post_id: post_id, user_id: user_id },
    });

    if (existingLike) {
      await this.prisma.communityLike.delete({
        where: { id: existingLike.id },
      });

      return {
        success: true,
        message: 'Post unliked successfully',
      };
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { id: true, },
      });

      if (!user) {
        throw new UnauthorizedException("user not found");
      }

      await this.prisma.communityLike.create({
        data: { post_id, user_id },
      });
      return {
        success: true,
        message: 'Post liked successfully',
      };
    }

  }

  async voteOnAPoll(post_id: string, option_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException("user not found");
    if (!post_id) throw new BadRequestException("invalid post id");
    if (!option_id) throw new BadRequestException("invalid option id");


    const vote = await this.prisma.communityPollVote.findFirst({
      where: { user_id: user_id, option: { post_id: post_id } },
    });
    if (!vote) {
      await this.prisma.communityPollVote.create({
        data: { user_id: user_id, option_id: option_id },
      });
      return { success: true, message: 'Voted successfully' };
    }

    if (vote.option_id === option_id) {
      await this.prisma.communityPollVote.delete({
        where: { id: vote.id },
      });
      return { success: true, message: 'Unvoted successfully' };
    }

    await this.prisma.communityPollVote.update({
      where: { id: vote.id },
      data: { option_id: option_id },
    });

    return { success: true, message: 'You changed your vote successfully' };

  }

  async commentPost(post_id: string, user_id: string, content: string, parent_id?: string) {
    if (!user_id) throw new UnauthorizedException("user not found");
    if (!post_id) throw new BadRequestException("invalid post id");
    if (!content) throw new BadRequestException("invalid content");

    if (parent_id) {
      const parentComment = await this.prisma.communityComment.findUnique({
        where: { id: parent_id },
        select: { id: true },
      });
      if (!parentComment) {
        throw new BadRequestException("parent comment not found");
      }
    }

    await this.prisma.communityComment.create({
      data: { post_id, user_id, content, parent_id },
    });

    return {
      success: true,
      message: 'Comment added successfully',
    };

  }

  async likeCommentOrReply(comment_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException("user not found");
    if (!comment_id) throw new BadRequestException("invalid comment id");

    const existingLike = await this.prisma.communityLike.findFirst({
      where: { comment_id: comment_id, user_id: user_id },
    });

    if (existingLike) {
      await this.prisma.communityLike.delete({
        where: { id: existingLike.id },
      });
      return {
        success: true,
        message: "Like removed successfully"
      }
    } else {
      const comment = await this.prisma.communityComment.findFirst({
        where: { id: comment_id },
        select: { id: true },
      });

      if (!comment) {
        throw new BadRequestException("comment or reply not found");
      }

      await this.prisma.communityLike.create({
        data: {
          comment_id: comment_id,
          user_id: user_id,
        },
      });

      return { success: true, message: 'Like added successfully' };
    }
  }

  async deleteComment(comment_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException("user not found");
    if (!comment_id) throw new BadRequestException("invalid comment id");

    const comment = await this.prisma.communityComment.findUnique({
      where: { id: comment_id },
      select: { user_id: true },
    });

    if (!comment) {
      throw new BadRequestException("comment not found");
    }

    if (comment.user_id !== user_id) {
      throw new UnauthorizedException("user not authorized to delete this comment");
    }

    try {
      await this.prisma.communityComment.delete({
        where: { id: comment_id },
      });
    } catch (error) {
      try {
        await this.prisma.communityComment.update({
          where: { id: comment_id },
          data: {
            deleted_at: new Date(),
          }
        })
      } catch (error) {
        throw new InternalServerErrorException("error deleting comment");
      }
    }

    return {
      success: true,
      message: 'Comment deleted successfully',
    };
  }

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

  async sharePost(user_id: string, post_id: string, medium?: string) {
    if (!user_id) throw new UnauthorizedException("user not found");
    if (!post_id) throw new BadRequestException("invalid post id");

    const post = await this.prisma.communityPost.findUnique({
      where: { id: post_id },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException("post not found");
    }

    await this.prisma.communityShare.create({
      data: {
        post_id,
        user_id,
        medium: medium,
      },
    });

    return {
      success: true,
      message: 'Post shared successfully',
    };

  }

  async getUserProfile(user_id: string) {
    if (!user_id) throw new BadRequestException("invalid user id");
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatar: true,
        cover_image: true,
        about: true,

      }
    });

    if (!user) {
      throw new NotFoundException("user not found");
    }

    return {
      success: true,
      data: {
        ...user,
        avatar: user.avatar ? SazedStorage.url(user.avatar) : null,
        cover_image: user.cover_image ? SazedStorage.url(user.cover_image) : null,
      }
    }

  }

  async reportUser(
    reporter_id: string,
    reported_id: string,
    reason: string,
    description?: string,
  ) {
    const reportedUser = await this.prisma.user.findUnique({
      where: { id: reported_id },
      select: {
        id: true,
      },
    });

    if (!reportedUser) {
      throw new NotFoundException("Reported user not found");
    }

    if (reporter_id === reported_id) {
      throw new UnprocessableEntityException("You cannot report yourself");
    }

    const existingReport = await this.prisma.userReport.findFirst({
      where: {
        reporter_id: reporter_id,
        reported_id: reported_id,
      },
    });

    if (existingReport) {
      throw new ConflictException("You have already reported this user");
    }

    await this.prisma.userReport.create({
      data: {
        reporter_id: reporter_id,
        reported_id: reported_id,
        reason,
        description,
      },
    });

    return {
      success: true,
      message: 'User reported successfully',
    };
  }
}
