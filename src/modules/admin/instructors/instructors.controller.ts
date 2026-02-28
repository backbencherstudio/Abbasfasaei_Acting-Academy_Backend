import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@ApiBearerAuth()
@ApiTags('Instructors')
//@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instructors')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @ApiResponse({ description: 'Get all teacher' })
  @Get()
  async getAllTeachers(
    @Query()
    query: {
      search?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      page?: string;
      limit?: string;
    },
  ) {
    try {
      return await this.instructorsService.getAllTeachers(query);
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
  async teacherDetails(@Param('id') teacherId: string) {
    try {
      return this.instructorsService.getTeacherDetails(teacherId);
    } catch (error) {}
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
