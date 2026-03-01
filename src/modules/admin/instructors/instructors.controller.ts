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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@ApiBearerAuth()
@ApiTags('Instructors')
//@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instructors')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @ApiOperation({ summary: 'Get all teachers' })
  @ApiResponse({
    status: 200,
    description: 'Teachers fetched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Teachers fetched successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'uuid-123' },
              name: { type: 'string', example: 'John Doe' },
              email: { type: 'string', example: 'john@example.com' },
              phone_number: { type: 'string', example: '+123456789' },
              experience_level: { type: 'string', example: 'Senior' },
              status: { type: 'string', example: 'ACTIVE' },
              joined_at: { type: 'string', format: 'date-time' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        meta_data: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 50 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            total_pages: { type: 'number', example: 5 },
          },
        },
      },
    },
  })
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

  @ApiOperation({ summary: 'Add a new teacher' })
  @ApiResponse({
    status: 201,
    description: 'Teacher created or updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Teacher created successfully' },
        data: {
          type: 'object',
          properties: {
            teacher: { type: 'object' },
            course: { type: 'object', nullable: true },
          },
        },
      },
    },
  })
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

  @ApiOperation({ summary: 'Get teacher details' })
  @ApiParam({ name: 'id', description: 'Teacher ID' })
  @ApiResponse({
    status: 200,
    description: 'Teacher details fetched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Teacher details fetched successfully',
        },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-123' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john@example.com' },
            avatar: { type: 'string', example: 'http://cdn.com/avatar.jpg' },
            status: { type: 'string', example: 'ACTIVE' },
            Course: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'course-uuid' },
                  title: { type: 'string', example: 'Acting 101' },
                },
              },
            },
          },
        },
      },
    },
  })
  @Get('details/:id')
  async teacherDetails(@Param('id') teacherId: string) {
    try {
      return this.instructorsService.getTeacherDetails(teacherId);
    } catch (error) {}
  }

  @ApiOperation({ summary: 'Update a teacher' })
  @ApiParam({ name: 'id', description: 'Teacher ID' })
  @ApiResponse({
    status: 200,
    description: 'Teacher updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Teacher updated successfully' },
        data: { type: 'object' },
      },
    },
  })
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
