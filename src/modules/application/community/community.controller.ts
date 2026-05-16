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
  UploadedFiles,
  Query,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SharePostDto } from './dto/share-post.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import {
  FilesInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { QueryCommunityFeedDto, QueryCommunityPostLikesDto } from './dto/query-community.dto';

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
  getFeed(
    @GetUser("userId") user_id: string,
    @Query() query: QueryCommunityFeedDto,

  ) {
    return this.service.getFeed(user_id, query);
  }

  // updated
  @Delete('post/:post_id')
  deletePost(@Param('post_id') post_id: string, @GetUser('userId') user_id: string) {
    return this.service.deletePost(post_id, user_id);
  }


  // updated
  @Get('posts/:post_id/likes')
  getLikes(@Param('post_id') post_id: string, @GetUser('userId') user_id: string,
    @Query() query: QueryCommunityPostLikesDto
  ) {
    return this.service.getLikes(post_id, user_id, query);
  }

  // updated
  @Post('posts/:post_id/like')
  likePost(@GetUser('userId') user_id: string, @Param('post_id') post_id: string) {
    return this.service.likePost(post_id, user_id);
  }

  // updated
  @Patch('post/:post_id/vote/:option_id')
  voteOnAPoll(
    @GetUser('userId') user_id: string,
    @Param('post_id') post_id: string,
    @Param('option_id') option_id: string,
  ) {
    return this.service.voteOnAPoll(post_id, option_id, user_id);
  }


  // updated
  @Post('post/:post_id/comment')
  async commentPost(
    @GetUser('userId') user_id: string,
    @Param('post_id') post_id: string,
    @Body('content') content: string,
    @Body('comment_id') comment_id?: string,
  ) {
    return this.service.commentPost(post_id, user_id, content, comment_id);
  }


  // updated
  @Get('post/:post_id/comments')
  getComments(@Param('post_id') post_id: string) {
    return this.service.getComments(post_id);
  }

  // updated
  @Post('posts/comments/:comment_id/like')
  likeCommentOrReply(
    @GetUser('userId') user_id: string,
    @Param('comment_id') comment_id: string,
  ) {
    return this.service.likeCommentOrReply(comment_id, user_id);
  }

  // updated
  @Patch('posts/comments/:comment_id/delete')
  deleteComment(@Param('comment_id') comment_id: string, @GetUser('userId') user_id: string) {
    return this.service.deleteComment(comment_id, user_id);
  }


  @Post('posts/:post_id/share')
  sharePost(@GetUser('userId') user_id: string, @Param('post_id') post_id: string, @Body('medium') medium?: string) {
    return this.service.sharePost(user_id, post_id, medium);
  }


  // updated
  @Get('profile/:user_id')
  getUserProfile(@Param('user_id') user_id: string) {
    return this.service.getUserProfile(user_id);
  }

  // updated
  @Post('report/:reported_user_id')
  reportUser(
    @GetUser('userId') user_id: string,
    @Param('reported_user_id') reported_user_id: string,
    @Body('reason') reason: string,
    @Body('description') description: string,
  ) {
    return this.service.reportUser(
      user_id,
      reported_user_id,
      reason,
      description,
    );
  }
}
