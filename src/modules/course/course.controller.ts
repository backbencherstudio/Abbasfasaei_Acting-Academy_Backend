import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  InternalServerErrorException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiOperation } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@UseGuards(JwtAuthGuard)
@Controller('course')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @ApiOperation({ summary: 'Get all available courses' })
  @Get('all')
  async getAllCourses() {
    try {
      console.log('hitted');
      const result = await this.courseService.getAllCourses();
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching courses');
    }
  }

  @ApiOperation({ summary: 'My courses' })
  @Get('my-courses')
  async getMyCourses(@GetUser() user) {
    try {
      if (!user || !user.userId) {
        throw new InternalServerErrorException('User not authenticated');
      }
      const result = await this.courseService.getMyCourses(user.userId);
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching my courses');
    }
  }

  @ApiOperation({ summary: 'Course details' })
  @Get('details/:courseId')
  async getCourseDetails(@Param('courseId') courseId: string, @GetUser() user) {
    try {
      const result = await this.courseService.getCourseDetails(
        courseId,
        user.userId,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching course details');
    }
  }

  @ApiOperation({ summary: 'My course details' })
  @Get('my-course-details/:courseId')
  async getMyCourseDetails(
    @Param('courseId') courseId: string,
    @GetUser() user,
  ) {
    try {
      const result = await this.courseService.getMyCourseDetails(
        courseId,
        user.userId,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error fetching my course details',
      );
    }
  }

  @ApiOperation({ summary: 'Get module details' })
  @Get('module/:moduleId')
  async getModuleDetails(@Param('moduleId') moduleId: string, @GetUser() user) {
    try {
      const result = await this.courseService.getModuleDetails(
        moduleId,
        user.userId,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching module details');
    }
  }

  @ApiOperation({ summary: 'Get class details' })
  @Get('class/:classId')
  async getClassDetails(@Param('classId') classId: string, @GetUser() user) {
    try {
      const result = await this.courseService.getClassDetails(
        classId,
        user.userId,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching class details');
    }
  }

  @ApiOperation({ summary: 'Get my Assignments for a course' })
  @Get('assignments/:courseId')
  async getAssignmentsForCourse(
    @Param('courseId') courseId: string,
    @GetUser() user,
  ) {
    try {
      const result = await this.courseService.getAssignmentsForCourse(
        courseId,
        user.userId,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching assignments');
    }
  }

  @ApiOperation({ summary: 'Submit assignment' })
  @Post('assignment/:assignmentId/submit')
  @UseInterceptors(
    FilesInterceptor('media', 5, {
      storage: memoryStorage(),
    }),
  )
  async submitAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() submitDto: SubmitAssignmentDto,
    @GetUser() user,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      const result = await this.courseService.submitAssignment(
        assignmentId,
        user.userId,
        submitDto,
        files,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error submitting assignment');
    }
  }

  @ApiOperation({ summary: 'Get course assets' })
  @Get('assets/:courseId')
  async getAllAssetsFromCourse(
    @Param('courseId') courseId: string,
    @GetUser() user,
  ) {
    try {
      const result = await this.courseService.getAllAssetsFromCourse(
        courseId,
        user.userId,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching course assets');
    }
  }
}
