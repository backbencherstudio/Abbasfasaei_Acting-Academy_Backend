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
    return this.coursesService.updateCourse(user.userId, id, updateCourseDto);
  }

  // @ApiOperation({ summary: 'Delete a course by ID' })
  // @Delete(':id')
  // remove(@GetUser() user: any, @Param('id') id: string) {
  //   return this.coursesService.remove(user.userId, id);
  // }
}
