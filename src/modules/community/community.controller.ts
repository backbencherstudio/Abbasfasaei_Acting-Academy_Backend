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
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CommentPostDto } from './dto/comment-post.dto';
import { SharePostDto } from './dto/share-post.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { de } from 'date-fns/locale';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('community')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunityController {
  constructor(private service: CommunityService) {}

  @Post('post')
  @UseInterceptors(
    FileInterceptor('media', {
      storage: memoryStorage(),
    }),
  )
  async createPost(
    @GetUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePostDto,
  ) {
    if (!user || !user.userId) {
      return { success: false, message: 'User not authenticated' };
    }

    return this.service.createPost(
      user.userId,
      dto.content,
      dto.mediaType,
      dto.visibility,
      file, // pass file to service
    );
  }

  @Get('feed')
  getFeed(@GetUser() user: any) {
    try {
      return this.service.getFeed(user.userId);
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

  // Update post
  @Patch('post/:postId')
  @UseInterceptors(
    FileInterceptor('media', {
      storage: memoryStorage(),
    }),
  )
  async updatePost(
    @Param('postId') postId: string,
    @GetUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePostDto,
  ) {
    try {
      return this.service.updatePost(
        postId,
        user.userId,
        dto,
        dto.mediaType,
        dto.visibility,
        file,
      );
    } catch (error) {
      throw new Error('Error updating post');
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

  @Get('like')
  getLikes(@Body('postId') postId: string) {
    try {
      return this.service.getLikes(postId);
    } catch (error) {
      throw new Error('Error fetching likes');
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
  editProfile(@GetUser() user: any, @Body() dto: any) {
    try {
      return this.service.editUserProfile(user.userId, dto);
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
