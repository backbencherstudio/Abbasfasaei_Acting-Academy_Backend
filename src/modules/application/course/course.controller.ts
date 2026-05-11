import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  InternalServerErrorException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { CourseService } from './course.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AcceptRulesOrContractDto, PInfoDto } from './dto/enroll.dto';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@ApiTags('Course')
@UseGuards(JwtAuthGuard)
@DisAllowDeactivated()
@Controller('course')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @ApiOperation({ summary: 'Enrollment: get all courses' })
  @Get('enrollment/courses')
  async getEnrollmentCourses() {
    return this.courseService.getEnrollmentCourses();
  }

  @Get('enrollment/current-step/:courseId')
  async getCurrentStep(@GetUser() user, @Param('courseId') courseId: string) {
    return this.courseService.getCurrentStep(user.userId, courseId);
  }

  @Post('enrollment/pinfo/:courseId')
  async enrollUser(
    @GetUser() user,
    @Param('courseId') courseId: string,
    @Body() dto: PInfoDto,
  ) {
    return this.courseService.enrollUser(user.userId, courseId, dto);
  }

  @Post('enrollment/accept-rules/:enrollmentId')
  async acceptRules(
    @GetUser() user,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: AcceptRulesOrContractDto,
  ) {
    if (
      !dto?.digital_signature_date ||
      isNaN(Date.parse(dto?.digital_signature_date))
    ) {
      throw new BadRequestException('Invalid signature date');
    }
    return this.courseService.acceptRules(user.userId, enrollmentId, dto);
  }

  @Post('enrollment/accept-contract/:enrollmentId')
  async acceptContract(
    @GetUser() user,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: AcceptRulesOrContractDto,
  ) {
    if (
      !dto?.digital_signature_date ||
      isNaN(Date.parse(dto?.digital_signature_date))
    ) {
      throw new BadRequestException('Invalid signature date');
    }
    return this.courseService.acceptContract(user.userId, enrollmentId, dto);
  }

  @Get('enrollment/my-courses')
  async myEnrollmentCourses(@GetUser() user) {
    return this.courseService.myEnrollmentCourses(user.userId);
  }

  @Post('attendance/scan-qr')
  async scanQR(@GetUser() user: any, @Body() body: any) {
    return this.courseService.scanQr(body?.token, user.userId);
  }

  @ApiOperation({ summary: 'Get all available courses' })
  @Get('all')
  async getAllCourses() {
    try {
      // console.log('hitted');
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

  @Get('assignments/details/:assignmentId')
  async getAssignmentDetails(
    @Param('assignmentId') assignmentId: string,
    @GetUser() user,
  ) {
    try {
      const result = await this.courseService.getAssignmentDetails(
        assignmentId,
        user.userId,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error fetching assignment details',
      );
    }
  }

  @Get('assignments/class/:classId')
  async getAssignmentsForClass(
    @Param('classId') classId: string,
    @GetUser() user,
  ) {
    try {
      const result = await this.courseService.getAssignmentsForClass(
        user.userId,
        classId,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching assignments');
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

  @Get('assets/class/:classId')
  async getAllAssets(@Param('classId') classId: string, @GetUser() user) {
    try {
      const result = await this.courseService.getAllAssets(
        classId,
        user.userId,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching assets');
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
