import { Controller, Get, Param } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { ApiOperation } from '@nestjs/swagger';
import { get } from 'http';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @ApiOperation({ summary: 'Get all courses' })
  @Get()
  findAll() {
    return this.coursesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(+id);
  }
}
