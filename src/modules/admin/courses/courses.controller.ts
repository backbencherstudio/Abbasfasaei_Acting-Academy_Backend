import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
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

@ApiBearerAuth()
@ApiTags('Courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @ApiOperation({ summary: 'Create a course' })
  @Post()
 async create_course(@GetUser() user: any, @Body() createCourseDto: CreateCourseDto) {
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
  updateCourse(@GetUser() user: any, @Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    console.log("course id in controller:", id);
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
  addModule(@GetUser() user: any, @Param('courseId') courseId: string, @Body() createModuleDto: CreateModuleDto) {
    return this.coursesService.addModule(user.userId, courseId, createModuleDto);
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
  updateModule(@GetUser() user: any, @Param('moduleId') moduleId: string, @Body() updateModuleDto: UpdateModuleDto) {
    return this.coursesService.updateModule(user.userId, moduleId, updateModuleDto);
  }

  @ApiOperation({ summary: 'Delete a module by ID' })
  @Delete('modules/:moduleId')
  deleteModule(@GetUser() user: any, @Param('moduleId') moduleId: string) {
    return this.coursesService.deleteModule(user.userId, moduleId);
  }


  //---------------------classes---------------------//



}
