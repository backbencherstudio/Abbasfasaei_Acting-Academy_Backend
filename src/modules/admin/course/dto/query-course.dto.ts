import { ApiProperty } from '@nestjs/swagger';
import {
  AssignmentSubmissionStatus,
  AttendanceStatus,
  CourseStatus,
} from '@prisma/client';
import { AssignmentStatus } from 'aws-sdk/clients/mturk';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsDate,
} from 'class-validator';

export class GetAllCourseQueryDto {
  @ApiProperty({
    description: 'User id',
    required: false,
    example: 'user id',
  })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiProperty({
    description: 'Search query',
    required: false,
    example: 'math',
  })
  @IsString()
  @IsOptional()
  search: string;

  @ApiProperty({
    description: 'Page number',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page: number = 1;

  @ApiProperty({
    description: 'Limit number',
    required: false,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit: number = 10;

  @ApiProperty({
    description: 'Status',
    required: false,
    example: 'ACTIVE',
  })
  @IsEnum(CourseStatus)
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : value.toUpperCase(),
  )
  @IsOptional()
  status?: CourseStatus;
}

export class GetAllAssignmentQueryDto {
  @ApiProperty({
    description: 'Search query',
    required: false,
    example: 'math',
  })
  @IsString()
  @IsOptional()
  search: string;

  @ApiProperty({
    description: 'Page number',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page: number = 1;

  @ApiProperty({
    description: 'Limit number',
    required: false,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit: number = 10;

  @ApiProperty({
    description: 'Status',
    required: false,
    example: 'ALL',
  })
  @IsEnum(AssignmentSubmissionStatus)
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : value.toUpperCase(),
  )
  @IsOptional()
  status?: AssignmentSubmissionStatus;
}

export class AttendanceQueryDto {
  @ApiProperty({
    description: 'Search query',
    required: false,
    example: 'math',
  })
  @IsString()
  @IsOptional()
  search: string;

  @ApiProperty({
    description: 'Class id',
    required: false,
    example: '1',
  })
  @IsString()
  @IsOptional()
  class_id?: string;

  @ApiProperty({
    description: 'Course id',
    required: false,
    example: '1',
  })
  @IsString()
  @IsOptional()
  course_id?: string;

  @ApiProperty({
    description: 'Page number',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page: number = 1;

  @ApiProperty({
    description: 'Limit number',
    required: false,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit: number = 10;

  @ApiProperty({
    description: 'Date',
    required: false,
    example: new Date().toISOString(),
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date: Date;

  @ApiProperty({
    description: 'Status',
    required: false,
    example: 'ALL',
  })
  @IsEnum(AttendanceStatus)
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : value.toUpperCase(),
  )
  @IsOptional()
  status?: AttendanceStatus;
}

export class GetAllEnrolledUserQueryDto {
  @ApiProperty({
    description: 'Search query',
    required: false,
    example: 'math',
  })
  @IsString()
  @IsOptional()
  search: string;

  @ApiProperty({
    description: 'Page number',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page: number = 1;

  @ApiProperty({
    description: 'Limit number',
    required: false,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit: number = 10;
}
