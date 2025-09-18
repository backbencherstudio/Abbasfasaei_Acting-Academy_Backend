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
import { AuthGuard } from '@nestjs/passport';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CreateAssignmentDto } from './dto/createAssignmentDto.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@ApiBearerAuth()
@ApiTags('Courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @ApiOperation({ summary: 'Create a course' })
  @Post()
  async create_course(
    @GetUser() user: any,
    @Body() createCourseDto: CreateCourseDto,
  ) {
    console.log('course create in controller:', user);
    return this.coursesService.create_course(user.userId, createCourseDto);
  }


  @ApiOperation({ summary: 'Get all courses' })
  @Get()
  getAllCourses(@GetUser() user: any) {
    return this.coursesService.getAllCourses(user.userId);
  }

  @ApiOperation({ summary: 'Get a course by ID' })
  @Get(':id')
  getCourseById(@GetUser() user: any, @Param('id') id: string) {
    return this.coursesService.getCourseById(user.userId, id);
  }

  @ApiOperation({ summary: 'Update a course by ID' })
  @Patch(':id')
  updateCourse(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    console.log('course id in controller:', id);
    return this.coursesService.updateCourse(user.userId, id, updateCourseDto);
  }

  @ApiOperation({ summary: 'Delete a course by ID' })
  @Delete(':id')
  deleteCourse(@GetUser() user: any, @Param('id') id: string) {
    return this.coursesService.deleteCourse(user.userId, id);
  }

  //---------------------module---------------------//
  @ApiOperation({ summary: 'Add a module to a course' })
  @Post(':courseId/modules')
  addModule(
    @GetUser() user: any,
    @Param('courseId') courseId: string,
    @Body() createModuleDto: CreateModuleDto,
  ) {
    return this.coursesService.addModule(
      user.userId,
      courseId,
      createModuleDto,
    );
  }

  @ApiOperation({ summary: 'Get all modules for a course' })
  @Get(':courseId/modules')
  getAllModules(@GetUser() user: any, @Param('courseId') courseId: string) {
    return this.coursesService.getAllModules(user.userId, courseId);
  }

  @ApiOperation({ summary: 'Get a module by ID' })
  @Get('modules/:moduleId')
  getModuleById(@GetUser() user: any, @Param('moduleId') moduleId: string) {
    return this.coursesService.getModuleById(user.userId, moduleId);
  }

  @ApiOperation({ summary: 'Update a module by ID' })
  @Patch('modules/:moduleId')
  updateModule(
    @GetUser() user: any,
    @Param('moduleId') moduleId: string,
    @Body() updateModuleDto: UpdateModuleDto,
  ) {
    return this.coursesService.updateModule(
      user.userId,
      moduleId,
      updateModuleDto,
    );
  }

  @ApiOperation({ summary: 'Delete a module by ID' })
  @Delete('modules/:moduleId')
  deleteModule(@GetUser() user: any, @Param('moduleId') moduleId: string) {
    return this.coursesService.deleteModule(user.userId, moduleId);
  }

  //---------------------classes---------------------//

  @ApiOperation({ summary: 'Add a class to a module' })
  @Post('modules/:moduleId/classes')
  addClass(
    @GetUser() user: any,
    @Param('moduleId') moduleId: string,
    @Body() createClassDto: any,
  ) {
    return this.coursesService.addClass(user.userId, moduleId, createClassDto);
  }

  @ApiOperation({ summary: 'Get all classes for a module' })
  @Get('modules/:moduleId/classes')
  getAllClasses(@GetUser() user: any, @Param('moduleId') moduleId: string) {
    return this.coursesService.getAllClasses(user.userId, moduleId);
  }

  @ApiOperation({ summary: 'Get a class by ID' })
  @Get('classes/:classId')
  getClassById(@GetUser() user: any, @Param('classId') classId: string) {
    return this.coursesService.getClassById(user.userId, classId);
  }

  @ApiOperation({ summary: 'Update a class by ID' })
  @Patch('classes/:classId')
  updateClass(
    @GetUser() user: any,
    @Param('classId') classId: string,
    @Body() updateClassDto: any,
  ) {
    return this.coursesService.updateClass(
      user.userId,
      classId,
      updateClassDto,
    );
  }

  @ApiOperation({ summary: 'Delete a class by ID' })
  @Delete('classes/:classId')
  deleteClass(@GetUser() user: any, @Param('classId') classId: string) {
    return this.coursesService.deleteClass(user.userId, classId);
  }

  //---------------------------- assignments Management -------------------------------//

  @ApiOperation({ summary: 'Create an assignment for a class' })
  @Post('classes/:classId/assignments')
  @UseInterceptors(
    FilesInterceptor('media', 5, {
      storage: memoryStorage(),
    }),
  )
  createAssignment(
    @GetUser() user: any,
    @Param('classId') classId: string,
    @Body() createAssignmentDto: CreateAssignmentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.coursesService.createAssignment(
      user.userId,
      classId,
      createAssignmentDto,
      files,
    );
  }

  @ApiOperation({ summary: 'Get all assignments for a class' })
  @Get('classes/:classId/assignments')
  async getAllAssignments(
    @GetUser() user: any,
    @Param('classId') classId: string,
  ) {
    return this.coursesService.getAllAssignments(user.userId, classId);
  }

  @ApiOperation({ summary: 'Get an assignment by ID' })
  @Get('assignments/:assignmentId')
  async getAssignmentById(
    @GetUser() user: any,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.coursesService.getAssignmentById(user.userId, assignmentId);
  }

  @ApiOperation({ summary: 'Update an assignment by ID' })
  @Patch('assignments/:assignmentId')
  @UseInterceptors(
    FilesInterceptor('media', 5, {
      storage: memoryStorage(),
    }),
  )
  async updateAssignment(
    @GetUser() user: any,
    @Param('assignmentId') assignmentId: string,
    @Body() updateAssignmentDto: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.coursesService.updateAssignment(
      user.userId,
      assignmentId,
      updateAssignmentDto,
      files,
    );
  }

  @ApiOperation({ summary: 'Delete an assignment by ID' })
  @Delete('assignments/:assignmentId')
  async deleteAssignment(
    @GetUser() user: any,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.coursesService.deleteAssignment(user.userId, assignmentId);
  }

  //---------------------------- Assignment Submission Management -------------------------------//

  @ApiOperation({ summary: 'Get all submissions for an assignment' })
  @Get('assignments/:assignmentId/submissions')
  async getAllAssignmentsSubmissions(
    @GetUser() user: any,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.coursesService.getAllAssignmentsSubmissions(
      user.userId,
      assignmentId,
    );
  }

  @ApiOperation({ summary: 'Get a submission by ID' })
  @Get('submissions/:submissionId')
  async getSubmissionById(
    @GetUser() user: any,
    @Param('submissionId') submissionId: string,
  ) {
    return this.coursesService.getSubmissionById(user.userId, submissionId);
  }

  @ApiOperation({ summary: 'Grade a submission by ID' })
  @Patch('submissions/:submissionId/grade')
  async gradeSubmission(
    @GetUser() user: any,
    @Param('submissionId') submissionId: string,
    @Body() gradeSubmissionDto: any,
  ) {
    return this.coursesService.gradeSubmission(
      user.userId,
      submissionId,
      gradeSubmissionDto,
    );
  }
}
