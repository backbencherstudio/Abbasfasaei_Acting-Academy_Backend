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
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetUserRoleDto } from './dto/set-user-role.dto';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@ApiTags('User')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiResponse({ description: 'Create a user' })
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    try {
      const user = await this.userService.create(createUserDto);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Get all users' })
  @Get()
  async findAll(
    @Query() query: { q?: string; type?: string; approved?: string },
  ) {
    try {
      const q = query.q;
      const type = query.type;
      const approved = query.approved;

      const users = await this.userService.findAll({ q, type, approved });
      return users;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // approve user
  @Roles(Role.ADMIN)
  @ApiResponse({ description: 'Approve a user' })
  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    try {
      const user = await this.userService.approve(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // reject user
  @Roles(Role.ADMIN)
  @ApiResponse({ description: 'Reject a user' })
  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    try {
      const user = await this.userService.reject(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Get a user by id' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const user = await this.userService.findOne(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Update a user by id' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      const user = await this.userService.update(id, updateUserDto);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Delete a user by id' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const user = await this.userService.remove(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // assign a role to a user
  @Roles(Role.ADMIN)
  @ApiResponse({ description: 'Assign a role to a user' })
  @Post(':id/assign-role')
  async assignRole(@Param('id') id: string, @Body() body: SetUserRoleDto) {
    try {
      const user = await this.userService.assignRole(id, body);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  //-------------------get all instructors-------------------//
  @ApiResponse({ description: 'Get all instructors' })
  @Get('instructors/all')
  async getAllInstructors() {
    try {
      const instructors = await this.userService.getAllInstructors();
      return instructors;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  //-------------------get all students-------------------//
  @ApiResponse({ description: 'Get all students' })
  @Get('students/all')
  async getAllStudents() {
    try {
      const students = await this.userService.getAllStudents();
      return students;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  //-------------------get all admins-------------------//
  @ApiResponse({ description: 'Get all admins' })
  @Get('admins/all')
  async getAllAdmins() {
    try {
      const admins = await this.userService.getAllAdmins();
      return admins;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
