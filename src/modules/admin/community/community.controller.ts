import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { QueryCommunityDto } from './dto/query-community.dto';
import { PostStatus } from '@prisma/client';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@ApiBearerAuth()
@ApiTags('Community')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
  ) { }


  // updated
  @Post()
  @UseInterceptors(FilesInterceptor('attachments', 10, { storage: memoryStorage() }))
  create(
    @GetUser('userId') user_id: string,
    @Body() createCommunityDto: CreateCommunityDto,
    @UploadedFiles() attachments: Express.Multer.File[]
  ) {
    return this.communityService.create(user_id, createCommunityDto, attachments);
  }

  // updated
  @ApiOperation({ summary: 'Get all community posts' })
  @Get('posts')
  async getAllPosts(@GetUser('userId') user_id: string, @Query() query: QueryCommunityDto) {
    return this.communityService.getAllPosts(user_id, query);
  }

  // updated
  @ApiOperation({ summary: 'Get a community post by ID' })
  @Get('posts/:post_id')
  getPostById(@Param('post_id') post_id: string, @GetUser('userId') user_id: string) {
    return this.communityService.getPostById(user_id, post_id);
  }

  // updated
  @Patch('post/:post_id/status')
  updatePostStatus(@Param('post_id') post_id: string, @GetUser('userId') user_id: string, @Body('status') status: PostStatus) {
    return this.communityService.changePostStatus(user_id, post_id, status);
  }

  // updated
  @ApiOperation({ summary: 'Delete a post' })
  @Delete('post/:post_id')
  deletePost(@Param('post_id') post_id: string, @GetUser('userId') user_id: string) {
    return this.communityService.deletePost(user_id, post_id);
  }
}
