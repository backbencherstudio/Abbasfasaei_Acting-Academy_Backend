import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  CreateCourseDto,
  CreateAssignmentDto,
  CreateAttendenceDto,
  CreateClassDto,
  CreateModuleDto,
} from './create-course.dto';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { CourseStatus } from '@prisma/client';

export class UpdateCourseDto extends PartialType(
  OmitType(CreateCourseDto, ['status']),
) {
  @IsOptional()
  @ApiProperty({ example: CourseStatus.DRAFT })
  @IsEnum(CourseStatus, { each: true })
  status?: CourseStatus;
}

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {}

export class UpdateAttendenceDto extends CreateAttendenceDto {
  @ApiProperty({ description: 'Attendance status', example: 'PRESENT/ABSENT' })
  @IsString()
  status: string;
}

export class UpdateClassDto extends PartialType(CreateClassDto) {}

export class UpdateModuleDto extends PartialType(CreateModuleDto) {}
