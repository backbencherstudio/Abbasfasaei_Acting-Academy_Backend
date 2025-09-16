import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserRepository } from 'src/common/repository/user/user.repository';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { create } from 'domain';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@ApiBearerAuth()
@ApiTags('Instructor')
//@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instructors')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @ApiResponse({ description: 'Get all teacher' })
  @Get()
  async getAllTeachers() // @Query() query: { q?: string; type?: string; approved?: string },
  {
    try {
      // const q = query.q;
      // const type = query.type;
      // const approved = query.approved;

      const teachers = await this.instructorsService.getAllTeachers();
      return teachers;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Create a user' })
  @Post()
  async addTeacher(@Body() createTeacherDto: CreateTeacherDto) {
    try {
      const addingTeacher =
        await this.instructorsService.addTeacher(createTeacherDto);
      console.log(`teacher added - ${addingTeacher}`);
      return addingTeacher;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiResponse({ description: 'Get Teacher Details' })
  @Get('details/:id')
  async teacherDetails(
    @Param('id') teacherId: string
  ) {
    try {
      return this.instructorsService.getTeacherDetails(teacherId);
    }
    catch (error) {}
  }



  @ApiResponse({ description: 'Update a teacher' })
  @Patch('update/:id')
  async updateTeacher(
    @Param('id') teacherId: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
  ) {
    try {
      const updatedTeacher = await this.instructorsService.updateTeacher(
        teacherId,
        updateTeacherDto,
      );
      return updatedTeacher;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
