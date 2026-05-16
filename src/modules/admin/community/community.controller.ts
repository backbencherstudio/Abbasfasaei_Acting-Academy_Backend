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

@ApiBearerAuth()
@ApiTags('Community')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
  ) { }

  @Post()
  create(@Body() createCommunityDto: CreateCommunityDto) {
    return this.communityService.create(createCommunityDto);
  }

  @ApiOperation({ summary: 'Get all community posts' })
  @Get('posts')
  async getAllPosts(@GetUser('userId') user_id: string, @Query() query: QueryCommunityDto) {
    return this.communityService.getAllPosts(user_id, query);
  }

  @ApiOperation({ summary: 'Get a community post by ID' })
  @Get('posts/:post_id')
  getPostById(@Param('post_id') post_id: string, @GetUser('userId') user_id: string) {
    return this.communityService.getPostById(user_id, post_id);
  }

  @Patch('post/:post_id/status')
  updatePostStatus(@Param('post_id') post_id: string, @GetUser('userId') user_id: string, @Body('status') status: PostStatus) {
    return this.communityService.changePostStatus(user_id, post_id, status);
  }

  @ApiOperation({ summary: 'Delete a post' })
  @Delete('post/:post_id')
  deletePost(@Param('post_id') post_id: string, @GetUser('userId') user_id: string) {
    return this.communityService.deletePost(user_id, post_id);
  }
}
