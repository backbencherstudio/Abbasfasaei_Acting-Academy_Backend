import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus, CourseStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsDate,
  IsEnum,
  Min,
} from 'class-validator';

export class CreateCourseDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Introduction to Acting' })
  title: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Course Overview' })
  course_overview: string;

  @IsOptional()
  @ApiProperty({ example: CourseStatus.DRAFT })
  @IsEnum(CourseStatus, { each: true })
  status?: CourseStatus = CourseStatus.ACTIVE;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ example: 100 })
  duration: number;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  @ApiProperty({ example: '2027-01-01' })
  start_date: Date;

  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 4) {
        const hours = parseInt(digits.substring(0, 2), 10);
        const minutes = parseInt(digits.substring(2, 4), 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      }
      throw new Error('Invalid time format. Use HH:MM (e.g., "17:00").');
    }
    return value;
  })
  @IsString()
  @ApiProperty({ example: '17:00' })
  class_time: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsString()
  @ApiProperty({ example: 'cmm5xlw8y0000kg30zwvz5s21' })
  instructor_id?: string;

  @IsNotEmpty()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  @ApiProperty({ example: 100 })
  fee_pence: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Installment Process' })
  installment_process: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ example: 100 })
  seat_capacity: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'write terms & conditions of the course' })
  contract: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'write rules & regulations of the course' })
  rules_regulations: string;
}

export class CreateAssignmentDto {
  @IsNotEmpty({ message: 'Assignment title is required' })
  @IsString()
  title: string;

  @IsNotEmpty({ message: 'Assignment description is required' })
  @IsString()
  description: string;

  @IsNotEmpty({ message: 'Submission date is required' })
  @Type(() => Date)
  @IsDate()
  submission_date: Date;

  @IsNotEmpty({ message: 'Total marks is required' })
  @IsNumber()
  @Min(0, { message: 'Total marks must be a non-negative number' })
  @Type(() => Number)
  total_marks: number;
}

export enum Grade {
  A_PLUS = 'A+',
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  F = 'F',
}

export class GradeAssignmentDto {
  @IsString()
  @IsOptional()
  @IsEnum(Grade)
  grade?: Grade;

  @IsString()
  @IsOptional()
  feedback?: string;

  @IsNumber()
  @IsOptional()
  grade_number?: number;
}

export class CreateAttendanceDto {}

export class CreateClassDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  class_title: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  class_name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  class_overview?: string;

  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  duration: number;

  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  class_date: Date;

  @ApiProperty()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 4) {
        const hours = parseInt(digits.substring(0, 2), 10);
        const minutes = parseInt(digits.substring(2, 4), 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      }
      throw new Error('Invalid time format. Use HH:MM (e.g., "17:00").');
    }
    return value;
  })
  @IsString()
  class_time: string;
}

export class CreateModuleDto {
  @ApiProperty({
    example: 'Module Name',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  module_name: string;

  @ApiProperty({
    example: 'Module Title',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  module_title: string;

  @ApiProperty({
    example: 'Module Overview',
    required: false,
  })
  @IsString()
  @IsOptional()
  module_overview?: string;
}
