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
import { UpdateUserDto } from './dto/update-user.dto';
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

@ApiBearerAuth()
@ApiTags('User')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Roles(Role.ADMIN)
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

  @Roles(Role.ADMIN, Role.TEACHER)
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
  @Roles(Role.ADMIN)
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
  @Roles(Role.ADMIN)
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
  @Roles(Role.ADMIN)
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

  @Get('admin/instructors')
  async getAllTeachers(
    @Query()
    query: {
      search?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      page?: string;
      limit?: string;
      teacherId?: string;
      includeClasses?: string;
    },
  ) {
    return this.userService.getAllTeachers(query);
  }

  @Post('admin/instructors')
  async addTeacher(@Body() createTeacherDto: CreateTeacherDto) {
    return this.userService.addTeacher(createTeacherDto);
  }

  @Get('admin/instructors/details/:id')
  async teacherDetails(@Param('id') teacherId: string) {
    return this.userService.getTeacherDetails(teacherId);
  }

  @Patch('admin/instructors/update/:id')
  async updateTeacher(
    @Param('id') teacherId: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
  ) {
    return this.userService.updateTeacher(teacherId, updateTeacherDto);
  }

  @Post('admin/student-management/manual-enrollment')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'rules_signing', maxCount: 1 },
        { name: 'contract_signing', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  async manualEnrollmentCombined(
    @GetUser() user: any,
    @Body() dto: CombinedEnrollmentDto,
    @UploadedFiles()
    files: {
      rules_signing?: Express.Multer.File[];
      contract_signing?: Express.Multer.File[];
    },
  ) {
    return this.userService.combinedEnrollment(user.userId, dto, files);
  }

  @Get('admin/student-management/student/:studentId')
  async getStudentById(@Param('studentId') studentId: string) {
    return this.userService.getStudentById(studentId);
  }

  @Get('admin/student-management')
  async getManagedStudents(
    @GetUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('experienceLevel') experienceLevel?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.userService.getManagedStudents(user.userId, {
      page: Number(page),
      limit: Number(limit),
      search,
      status,
      experienceLevel,
      paymentStatus,
      courseId,
    });
  }

  @Patch('admin/student-management/enrollment/:enrollmentId')
  async updateEnrollmentInfo(
    @Param('enrollmentId') enrollmentId: string,
    @Body() updateData: any,
  ) {
    return this.userService.updateEnrollmentInfo(enrollmentId, updateData);
  }

  @Patch('admin/student-management/enrollment/:enrollmentId/restrict')
  async restrictStudentAccess(
    @Param('enrollmentId') enrollmentId: string,
    @Body() updateData: any,
  ) {
    return this.userService.restrictStudentAccess(enrollmentId, updateData);
  }
}
