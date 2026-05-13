import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CourseService } from './course.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';

@ApiTags('Course')
@UseGuards(JwtAuthGuard, RolesGuard)
@DisAllowDeactivated()
@Controller('course')
export class CourseController {
  constructor(private readonly courseService: CourseService) { }

  // -------------------------------------------------

  //updated
  @ApiOperation({ summary: 'Get all available courses' })
  @Get()
  getAllCourses(@GetUser('userId') user_id: string, @Query('my_courses') my_courses?: string) {
    return this.courseService.getAllCourses(user_id, my_courses);
  }

  // updated
  @ApiOperation({ summary: 'Course details' })
  @Get(':course_id')
  getCourseDetails(
    @Param('course_id') course_id: string,
    @GetUser('userId') user_id: string,
  ) {
    return this.courseService.getCourseDetails(course_id, user_id);
  }


  // updated
  @ApiOperation({ summary: 'Get my assignments for a course' })
  @Get(':course_id/assignment')
  getAssignmentsForCourse(
    @Param('course_id') course_id: string,
    @GetUser('userId') user_id: string,
  ) {
    return this.courseService.getAssignmentsForCourse(course_id, user_id);
  }

  //updated
  @ApiOperation({ summary: 'Get course assets' })
  @Get(':course_id/assets')
  getAllAssetsFromCourse(
    @Param('course_id') course_id: string,
    @GetUser('userId') user_id: string,
    @Query('type') type?: "VIDEO" | 'FILE',
  ) {
    return this.courseService.getAllAssetsFromCourse(course_id, user_id, type);
  }

  private validateSignatureDate(signatureDate: string) {
    if (!signatureDate || Number.isNaN(Date.parse(signatureDate))) {
      throw new BadRequestException('Invalid signature date');
    }
  }


  // updated
  @ApiOperation({ summary: 'Get module details' })
  @Get('module/:module_id')
  getModuleDetails(
    @Param('module_id') module_id: string,
    @GetUser('userId') user_id: string,
  ) {
    return this.courseService.getModuleDetails(module_id, user_id);
  }


  // updated

  @ApiOperation({ summary: 'Get class details' })
  @Get('module/class/:class_id')
  getClassDetails(
    @Param('class_id') class_id: string,
    @GetUser('userId') user_id: string,
  ) {
    return this.courseService.getClassDetails(class_id, user_id);
  }

  // updated
  @Get('module/class/assignment/:assignment_id')
  getAssignmentDetails(
    @Param('assignment_id') assignment_id: string,
    @GetUser('userId') user_id: string,
  ) {
    return this.courseService.getAssignmentDetails(assignment_id, user_id);
  }

  //updated
  @ApiOperation({ summary: 'Get all assignments for a class' })
  @Get('module/class/:class_id/assignments')
  getAssignmentsForClass(
    @Param('class_id') class_id: string,
    @GetUser('userId') userId: string,
  ) {
    return this.courseService.getAssignmentsForClass(userId, class_id);
  }

  // updated
  @ApiOperation({ summary: 'Submit assignment' })
  @Post('module/class/assignment/:assignment_id')
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: memoryStorage(),
    }),
  )
  submitAssignment(
    @Param('assignment_id') assignment_id: string,
    @Body() submitAssignmentDto: SubmitAssignmentDto,
    @GetUser('userId') user_id: string,
    @UploadedFiles() attachments: Express.Multer.File[],
  ) {
    return this.courseService.submitAssignment(
      assignment_id,
      user_id,
      submitAssignmentDto,
      attachments,
    );
  }


  // updated
  @ApiOperation({ summary: 'Get all assets for a class' })
  @Get('module/class/:class_id/assets')
  getAllAssets(
    @Param('class_id') class_id: string,
    @GetUser('userId') user_id: string,
  ) {
    return this.courseService.getAllAssets(user_id, class_id);
  }


  // updated
  @Get(':course_id/enrollment/current_step')
  getCurrentStep(
    @GetUser('userId') user_id: string,
    @Param('course_id') course_id: string,
  ) {
    return this.courseService.getCurrentStep(user_id, course_id);
  }

  // updated
  @Post(':course_id/enrollment')
  enrollUser(
    @GetUser('userId') userId: string,
    @Param('courseId') courseId: string,
    @Body() createEnrollmentDto: CreateEnrollmentDto,
  ) {
    return this.courseService.enrollUser(userId, courseId, createEnrollmentDto);
  }
  // --------------------------------------------------------------

  @Post('attendance/scan-qr')
  scanQR(@GetUser('userId') userId: string, @Body('token') token: string) {
    return this.courseService.scanQr(token, userId);
  }
}
