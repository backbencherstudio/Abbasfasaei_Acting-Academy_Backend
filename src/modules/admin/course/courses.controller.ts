import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Query,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ApiOperation } from '@nestjs/swagger/dist/decorators/api-operation.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { ApiTags } from '@nestjs/swagger/dist/decorators/api-use-tags.decorator';
import { ApiBearerAuth } from '@nestjs/swagger/dist/decorators/api-bearer.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CreateAssignmentDto, GradeAssignmentDto } from './dto/create-assignment.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GetAllAssignmentQueryDto, GetAllCourseQueryDto } from './dto/query-course.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@ApiBearerAuth()
@ApiTags('Courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) { }

  @Roles(Role.ADMIN, Role.TEACHER)
  @Post('attendance/generate-qr/:classId')
  async generateQR(@GetUser() user: any, @Param('classId') classId: string) {
    try {
      const qrData = await this.coursesService.generateClassQR(
        classId,
        user?.userId,
      );
      return {
        success: true,
        message: 'QR code generated successfully. Valid for 1 hour.',
        data: qrData,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error generating QR code',
        error: error.message,
      };
    }
  }

  @Roles(Role.ADMIN, Role.TEACHER)
  @Get('attendance')
  async getAllAttendance(
    @Query()
    query: {
      status?: string;
      date?: string;
      classId?: string;
      courseId?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    return this.coursesService.getAllAttendance(query);
  }

  @Roles(Role.ADMIN, Role.TEACHER)
  @Post('attendance/manual')
  async markManualAttendance(
    @GetUser() user: any,
    @Body()
    body: {
      classId?: string;
      studentId?: string;
      status?: string;
      attendedAt?: string;
    },
  ) {
    return this.coursesService.markManualAttendance(body, user?.userId);
  }

  // updated
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a course' })
  @Post()
  async createCourse(
    @GetUser() user: any,
    @Body() createCourseDto: CreateCourseDto,
  ) {
    return this.coursesService.createCourse(user.userId, createCourseDto);
  }


  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Get all courses' })
  @Get()
  getAllCourses(@GetUser() user: any, @Query() query: GetAllCourseQueryDto) {
    return this.coursesService.getAllCourses(user.userId, query);
  }

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Get a course by ID' })
  @Get(':course_id')
  getCourseById(@GetUser() user: any, @Param('course_id') course_id: string) {
    return this.coursesService.getCourseById(user.userId, course_id);
  }


  // updated
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a course by ID' })
  @Patch(':course_id')
  updateCourse(
    @GetUser() user: any,
    @Param('course_id') course_id: string,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    return this.coursesService.updateCourse(user.userId, course_id, updateCourseDto);
  }

  // updated
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a course by ID' })
  @Delete(':course_id')
  deleteCourse(@GetUser() user: any, @Param('course_id') course_id: string) {
    return this.coursesService.deleteCourse(user.userId, course_id);
  }

  //---------------------module---------------------//

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Add a module to a course' })
  @Post(':course_id/modules')
  addModule(
    @GetUser('userId') user_id: string,
    @Param('course_id') course_id: string,
    @Body() createModuleDto: CreateModuleDto,
  ) {
    return this.coursesService.addModule(
      user_id,
      course_id,
      createModuleDto,
    );
  }

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Get all modules for a course' })
  @Get(':course_id/modules')
  getAllModules(@GetUser("user_id") user_id: string, @Param('course_id') course_id: string) {
    return this.coursesService.getAllModules(user_id, course_id);
  }

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Get a module by ID' })
  @Get('modules/:module_id')
  getModuleById(@GetUser("user_id") user_id: string, @Param('module_id') module_id: string) {
    return this.coursesService.getModuleById(user_id, module_id);
  }


  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Update a module by ID' })
  @Patch('modules/:module_id')
  updateModule(
    @GetUser('userId') user_id: string,
    @Param('module_id') module_id: string,
    @Body() updateModuleDto: UpdateModuleDto,
  ) {
    return this.coursesService.updateModule(
      user_id,
      module_id,
      updateModuleDto,
    );
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a module by ID' })
  @Delete('modules/:module_id')
  deleteModule(@GetUser('userId') user_id: string, @Param('module_id') module_id: string) {
    return this.coursesService.deleteModule(user_id, module_id);
  }

  //---------------------classes---------------------//

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Add a class to a module' })
  @Post('modules/:module_id/classes')
  addClass(
    @GetUser('userId') user_id: string,
    @Param('module_id') module_id: string,
    @Body() createClassDto: CreateClassDto,
  ) {
    return this.coursesService.addClass(user_id, module_id, createClassDto);
  }

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Get all classes for a module' })
  @Get('modules/:module_id/classes')
  getAllClasses(@GetUser("userId") user_id: string, @Param('module_id') module_id: string) {
    return this.coursesService.getAllClasses(user_id, module_id);
  }

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Get a class by ID' })
  @Get('modules/classes/:class_id')
  getClassById(@GetUser('userId') user_id: string, @Param('class_id') class_id: string) {
    return this.coursesService.getClassById(user_id, class_id);
  }


  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Update a class by ID' })
  @Patch('modules/classes/:class_id')
  updateClass(
    @GetUser('userId') user_id: string,
    @Param('class_id') class_id: string,
    @Body() updateClassDto: UpdateClassDto,
  ) {
    return this.coursesService.updateClass(user_id, class_id, updateClassDto);
  }
  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a class by ID' })
  @Delete('modules/classes/:class_id')
  deleteClass(@GetUser('userId') user_id: string, @Param('class_id') class_id: string) {
    return this.coursesService.deleteClass(user_id, class_id);
  }

  // TODO: start and ends class will be create in future

  //---------------------------- assignments Management -------------------------------//

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Create an assignment for a class' })
  @Post('modules/classes/:class_id/assignments')
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: memoryStorage(),
    }),
  )
  createAssignment(
    @GetUser('userId') user_id: string,
    @Param('class_id') class_id: string,
    @Body() createAssignmentDto: CreateAssignmentDto,
    @UploadedFiles() attachments: Express.Multer.File[],
  ) {
    return this.coursesService.createAssignment(
      user_id,
      class_id,
      createAssignmentDto,
      attachments,
    );
  }

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Get all assignments for a class' })
  @Get('modules/classes/:class_id/assignments')
  async getAllAssignments(
    @GetUser('userId') user_id: string,
    @Param('class_id') class_id: string,
  ) {
    return this.coursesService.getAllAssignments(user_id, class_id);
  }


  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Get an assignment by ID' })
  @Get('modules/classes/assignments/:assignment_id')
  async getAssignmentById(
    @GetUser('userId') user_id: string,
    @Param('assignment_id') assignment_id: string,
  ) {
    return this.coursesService.getAssignmentById(user_id, assignment_id);
  }


  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Update an assignment by ID' })
  @Patch('modules/classes/assignments/:assignment_id')
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: memoryStorage(),
    }),
  )
  async updateAssignment(
    @GetUser('userId') user_id: string,
    @Param('assignment_id') assignment_id: string,
    @Body() updateAssignmentDto: UpdateAssignmentDto,
    @UploadedFiles() attachments: Express.Multer.File[],
  ) {
    return this.coursesService.updateAssignment(
      user_id,
      assignment_id,
      updateAssignmentDto,
      attachments,
    );
  }

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete an assignment by ID' })
  @Delete('modules/classes/assignments/:assignment_id')
  async deleteAssignment(
    @GetUser('userId') user_id: string,
    @Param('assignment_id') assignment_id: string,
  ) {
    return this.coursesService.deleteAssignment(user_id, assignment_id);
  }

  //---------------------------- Assignment Submission Management -------------------------------//

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Get all submissions for an assignment' })
  @Get('modules/classes/assignments/:assignment_id/submissions')
  async getAllAssignmentsSubmissions(
    @GetUser('userId') user_id: string,
    @Param('assignment_id') assignment_id: string,
    @Query() query: GetAllAssignmentQueryDto,
  ) {
    return this.coursesService.getAllAssignmentsSubmissions(
      user_id,
      assignment_id,
      query,
    );
  }


  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Grade a submission by ID' })
  @Post('modules/classes/assignments/submissions/:submission_id/grade')
  async gradeSubmission(
    @GetUser('userId') user_id: string,
    @Param('submission_id') submission_id: string,
    @Body()
    gradeAssignmentDto: GradeAssignmentDto,
  ) {
    return this.coursesService.gradeSubmission(
      user_id,
      submission_id,
      gradeAssignmentDto,
    );
  }


  // ---------------------------- Class Assets Management -------------------------------//



  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Upload media files for a class' })
  @Post('modules/classes/:class_id/assets')
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: memoryStorage(),
    }),
  )
  async uploadClassAsset(
    @GetUser('userId') user_id: string,
    @Param('class_id') class_id: string,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 50 }),

          new FileTypeValidator({
            fileType: /^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|x-msvideo|x-matroska)|application\/(pdf|msword|vnd.openxmlformats-officedocument.*)|text\/plain)$/,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    attachments: Express.Multer.File[],
  ) {
    return this.coursesService.uploadClassAsset(
      user_id,
      class_id,
      attachments,
    );
  }

  // updated
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Get all media assets for a class' })
  @Get('modules/classes/:class_id/assets')
  async getClassAssets(
    @GetUser('userId') user_id: string,
    @Param('class_id') class_id: string,
  ) {
    return this.coursesService.getClassAssets(user_id, class_id);
  }


  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a media asset from a class' })
  @Delete('modules/classes/assets/:asset_id')
  async deleteClassAsset(
    @GetUser('userId') user_id: string,
    @Param('asset_id') asset_id: string,
  ) {
    return this.coursesService.deleteClassAsset(user_id, asset_id);
  }
}
