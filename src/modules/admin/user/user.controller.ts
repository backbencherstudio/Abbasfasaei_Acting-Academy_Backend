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
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserStatusDto } from './dto/update-user.dto';
import { SetUserRoleDto } from './dto/set-user-role.dto';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CombinedEnrollmentDto } from './dto/combined-enrollment.dto';
import { QueryUserDto } from './dto/query-user.dto';

@ApiBearerAuth()
@ApiTags('User')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  // updated
  @ApiResponse({ description: 'Create a user' })
  @Post()
  create(@Body() createUserDto: CreateUserDto, @GetUser('userId') user_id: string) {
    return this.userService.create(createUserDto, user_id);
  }


  // updated
  @ApiResponse({ description: 'Get all users' })
  @Get()
  findAll(
    @Query() query: QueryUserDto,
    @GetUser('userId') user_id: string
  ) {
    return this.userService.findAll(query, user_id);
  }

  // approve user
  @ApiResponse({ description: 'Approve a user' })
  @Post(':user_id/approve')
  approve(@Param('user_id') user_id: string, @GetUser('userId') admin_id: string) {
    return this.userService.approve(user_id, admin_id);

  }

  // reject user)
  @ApiResponse({ description: 'Reject a user' })
  @Post(':user_id/reject')
  reject(@Param('user_id') user_id: string, @GetUser('userId') admin_id: string) {
    return this.userService.reject(user_id, admin_id);
  }

  @ApiResponse({ description: 'Get a user by id' })
  @Get(':user_id')
  findOne(@Param('user_id') user_id: string, @GetUser('userId') admin_id: string) {
    return this.userService.findOne(user_id, admin_id);
  }

  @ApiResponse({ description: 'Update a user by id' })
  @Patch(':user_id')
  update(@Param('user_id') user_id: string, @Body() updateUserDto: UpdateUserDto, @GetUser('userId') admin_id: string) {
    return this.userService.update(user_id, updateUserDto, admin_id);
  }

  @ApiResponse({ description: 'Update user status by id' })
  @Patch(':user_id/status')
  updateStatus(@Param('user_id') user_id: string, @Body() updateStatusDto: UpdateUserStatusDto, @GetUser('userId') admin_id: string) {
    return this.userService.updateStatus(user_id, updateStatusDto.status, admin_id);
  }


  @ApiResponse({ description: 'Delete a user by id' })
  @Delete(':user_id')
  remove(@Param('user_id') user_id: string, @GetUser('userId') admin_id: string) {
    return this.userService.remove(user_id, admin_id);
  }
}
