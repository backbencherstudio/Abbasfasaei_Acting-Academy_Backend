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

  @ApiOperation({ summary: 'Get all requested posts' })
  @Get('requested-posts')
  async getAllRequestedPost(
    @GetUser() user: any,
    @Query() query: QueryCommunityDto,
  ) {
    return this.communityService.getAllRequestedPost(
      user.userId,
      query,
    );
  }

  @ApiOperation({ summary: 'Get a community post by ID' })
  @Get('requested-posts/:id')
  getPostById(@Param('id') id: string, @GetUser() user: any) {
    return this.communityService.getPostById(user.userId, id);
  }

  @ApiOperation({ summary: 'Approve a post' })
  @Patch('approve-post/:id')
  approvePost(@Param('id') id: string, @GetUser() user: any) {
    return this.communityService.approvePost(user.userId, id);
  }

  @ApiOperation({ summary: 'Reject a post' })
  @Patch('reject-post/:id')
  rejectPost(@Param('id') id: string, @GetUser() user: any) {
    return this.communityService.rejectPost(user.userId, id);
  }

  @ApiOperation({ summary: 'Flag or unflag a post' })
  @Patch('flag-unflag-post/:id')
  flagUnflagPost(@Param('id') id: string, @GetUser() user: any) {
    return this.communityService.flagUnflagPost(user.userId, id);
  }

  @ApiOperation({ summary: 'Delete a post' })
  @Delete('delete-post/:id')
  deletePost(@Param('id') id: string, @GetUser() user: any) {
    return this.communityService.deletePost(user.userId, id);
  }
}
