import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  CreateCourseDto,
  CreateAssignmentDto,
  CreateAttendenceDto,
  CreateClassDto,
  CreateModuleDto,
} from './create-course.dto';
import { IsString } from 'class-validator';

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {}

export class UpdateAttendenceDto extends CreateAttendenceDto {
  @ApiProperty({ description: 'Attendance status', example: 'PRESENT/ABSENT' })
  @IsString()
  status: string;
}

export class UpdateClassDto extends PartialType(CreateClassDto) {}

export class UpdateModuleDto extends PartialType(CreateModuleDto) {}
