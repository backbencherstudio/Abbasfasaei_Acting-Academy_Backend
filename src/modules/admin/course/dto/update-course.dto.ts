import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  CreateCourseDto,
  CreateAssignmentDto,
  CreateAttendanceDto,
  CreateClassDto,
  CreateModuleDto,
} from './create-course.dto';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsDate,
} from 'class-validator';
import { AttendanceStatus, CourseStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateCourseDto extends PartialType(
  OmitType(CreateCourseDto, ['status']),
) {
  @IsOptional()
  @ApiProperty({ example: CourseStatus.DRAFT })
  @IsEnum(CourseStatus, { each: true })
  status?: CourseStatus;
}

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {}

export class UpdateAttendanceDto extends CreateAttendanceDto {
  @IsString()
  @IsNotEmpty()
  class_id: string;

  @IsString()
  @IsNotEmpty()
  student_id: string;

  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  attended_at?: Date;
}

export class UpdateClassDto extends PartialType(CreateClassDto) {}

export class UpdateModuleDto extends PartialType(CreateModuleDto) {}
