import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Param,
  Delete,
  Patch,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Query,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CommentPostDto } from './dto/comment-post.dto';
import { SharePostDto } from './dto/share-post.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import {
  FileFieldsInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { EditProfileDto } from './dto/update-community-profile.dto';

@Controller('community')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
@DisAllowDeactivated()
export class CommunityController {
  constructor(private service: CommunityService) { }


  // updated
  @Post('post')
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: memoryStorage(),
    }),
  )
  async createPost(
    @GetUser('userId') user_id: string,
    @UploadedFiles() attachments: Express.Multer.File[],
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.service.createPost(user_id, createPostDto, attachments);
  }

  // updated
  @Patch('post/:post_id')
  async updatePost(
    @Param('post_id') post_id: string,
    @GetUser('userId') user_id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.service.updatePost(post_id, user_id, updatePostDto);
  }

  // updated
  @Get('feed')
  getFeed(@GetUser("userId") user_id: string, @Query('user_id') user_id_q?: string) {
    return this.service.getFeed(user_id, user_id_q);
  }


  @Get('my-posts')
  geMyPosts(@GetUser() user: any) {
    try {
      return this.service.getFeed(user.userId, user.userId);
    } catch (error) {
      throw new Error('Error fetching feed');
    }
  }

  @Delete('post/:postId')
  deletePost(@Param('postId') postId: string, @GetUser() user: any) {
    try {
      return this.service.deletePost(postId, user.userId);
    } catch (error) {
      throw new Error('Error deleting post');
    }
  }
  @Get('like')
  getLikes(@Body('postId') postId: string) {
    try {
      return this.service.getLikes(postId);
    } catch (error) {
      throw new Error('Error fetching likes');
    }
  }

  @Post('like')
  likePost(@GetUser() user: any, @Body('postId') postId: string) {
    try {
      return this.service.likePost(postId, user.userId);
    } catch (error) {
      throw new Error('Error liking post');
    }
  }

  @Patch('vote/:postId/:optionId')
  voteOnAPoll(
    @GetUser() user: any,
    @Param('postId') postId: string,
    @Param('optionId') optionId: string,
  ) {
    try {
      return this.service.voteOnAPoll(postId, optionId, user.userId);
    } catch (error) {
      throw new Error('Error voting on poll');
    }
  }

  @Post('comment/:postId')
  async commentPost(
    @GetUser() user: any,
    @Param('postId') postId: string,
    @Body() dto: CommentPostDto,
  ) {
    try {
      console.log(
        'user id',
        user.userId,
        'postId',
        postId,
        'content',
        dto.content,
      );
      return this.service.commentPost(postId, user.userId, dto.content);
    } catch (error) {
      throw new Error('Error commenting on post');
    }
  }

  @Get('comment/:postId')
  getComments(@Param('postId') postId: string) {
    try {
      return this.service.getComments(postId);
    } catch (error) {
      throw new Error('Error fetching comments');
    }
  }

  @Post('comment/reply/:commentId')
  async replyToCommentOrReply(
    @GetUser() user: any,
    @Param('commentId') parentId: string,
    @Body('postId') postId: string,
    @Body('content') content: string,
  ) {
    return this.service.replyToCommentOrReply(
      postId,
      parentId,
      user.userId,
      content,
    );
  }

  // Controller for liking a comment or reply
  @Post('comments')
  async likeCommentOrReply(
    @GetUser() user: any,
    @Body('commentId') commentId: string,
  ) {
    try {
      // Call the service method to like/unlike the comment or reply
      return await this.service.likeCommentOrReply(commentId, user.userId);
    } catch (error) {
      // Return a generic error message
      throw new Error('Error liking comment or reply');
    }
  }

  @Post('share')
  sharePost(@GetUser() user: any, @Body() dto: SharePostDto) {
    try {
      return this.service.sharePost(dto.postId, user.userId);
    } catch (error) {
      throw new Error('Error sharing post');
    }
  }

  @Get('my-profile')
  getMyProfile(@GetUser() user: any) {
    try {
      return this.service.getMyProfile(user.userId);
    } catch (error) {
      throw new Error('Error fetching user profile');
    }
  }

  @Patch('edit-profile')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'cover_image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
      },
    ),
  )
  editProfile(
    @GetUser() user: any,
    @Body() dto: EditProfileDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      cover_image?: Express.Multer.File[];
    },
  ) {
    try {
      return this.service.editUserProfile(user.userId, dto, files);
    } catch (error) {
      throw new Error('Error updating user profile');
    }
  }

  @Get('profile/:userId')
  getUserProfile(@Param('userId') userId: string) {
    try {
      return this.service.getUserProfile(userId);
    } catch (error) {
      throw new Error('Error fetching user profile');
    }
  }

  @Post('report/:userId')
  reportUser(
    @GetUser() user: any,
    @Param('userId') reportedUserId: string,
    @Body('reason') reason: string,
    @Body('description') description: string,
  ) {
    try {
      return this.service.reportUser(
        user.userId,
        reportedUserId,
        reason,
        description,
      );
    } catch (error) {
      throw new Error('Error reporting user');
    }
  }

  @Roles(Role.ADMIN)
  @Get('report')
  getAllReports(@GetUser() user: any) {
    try {
      return this.service.getAllReports(user.userId);
    } catch (error) {
      throw new Error('Error fetching all reports');
    }
  }
}
