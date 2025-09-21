import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CommunityManagementService } from './community-management.service';
import { CreateCommunityManagementDto } from './dto/create-community-management.dto';
import { UpdateCommunityManagementDto } from './dto/update-community-management.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { PostStatus } from '@prisma/client';

@ApiBearerAuth()
@ApiTags('Community Management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/community-management')
export class CommunityManagementController {
  constructor(
    private readonly communityManagementService: CommunityManagementService,
  ) {}

  @Post()
  create(@Body() createCommunityManagementDto: CreateCommunityManagementDto) {
    return this.communityManagementService.create(createCommunityManagementDto);
  }

  @ApiOperation({ summary: 'Get all community posts' })
  @Get('posts')
  async getAllPosts(@GetUser() user: any) {
    return this.communityManagementService.getAllPosts(user.userId);
  }

  @ApiOperation({ summary: 'Get all requested posts' })
  @Get('requested-posts')
  async getAllRequestedPost(@GetUser() user: any) {
    return this.communityManagementService.getAllRequestedPost(user.userId);
  }

  @ApiOperation({ summary: 'Get a community management by ID' })
  @Get('requested-posts/:id')
  getPostById(@Param('id') id: string, @GetUser() user: any) {
    return this.communityManagementService.getPostById(user.userId, id);
  }

  @ApiOperation({ summary: 'Get all posts by status' })
  @Get('posts/status/:status')
  async getAllPostsByStatus(
    @Param('status') status: PostStatus,
    @GetUser() user: any,
  ) {
    return this.communityManagementService.getAllPostsByStatus(
      user.userId,
      status,
    );
  }

  @ApiOperation({ summary: 'Get all posts by role' })
  @Get('posts/role/:role')
  async getAllPostsByRole(@Param('role') role: string, @GetUser() user: any) {
    return this.communityManagementService.getAllPostsByRole(user.userId, role);
  }

  @ApiOperation({ summary: 'Approve a post' })
  @Patch('approve-post/:id')
  approvePost(@Param('id') id: string, @GetUser() user: any) {
    return this.communityManagementService.approvePost(user.userId, id);
  }

  @ApiOperation({ summary: 'Reject a post' })
  @Patch('reject-post/:id')
  rejectPost(@Param('id') id: string, @GetUser() user: any) {
    return this.communityManagementService.rejectPost(user.userId, id);
  }

  @ApiOperation({ summary: 'Flag or unflag a post' })
  @Patch('flag-unflag-post/:id')
  flagUnflagPost(@Param('id') id: string, @GetUser() user: any) {
    return this.communityManagementService.flagUnflagPost(user.userId, id);
  }

  @ApiOperation({ summary: 'Delete a post' })
  @Delete('delete-post/:id')
  deletePost(@Param('id') id: string, @GetUser() user: any) {
    return this.communityManagementService.deletePost(user.userId, id);
  }
}
