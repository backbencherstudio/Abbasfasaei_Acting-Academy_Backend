import { ApiProperty } from '@nestjs/swagger';
import { ExperienceLevel } from '@prisma/client';
import {
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsString,
  IsEnum,
} from 'class-validator';

export class CreateTeacherDto {
  // User Basic Info
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'teacher' })
  name: string;

  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({ example: 'teacher@gmail.com' })
  email: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '225 555 0118' })
  phone_number: string;

  // Teacher Specific Info
  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'Active' })
  teacherType: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'kjhrf12323', required: false })
  courseId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'teacher123', required: false })
  password?: string;

  @IsNotEmpty()
  @IsEnum(ExperienceLevel)
  @ApiProperty({ example: 'BEGINNER | INTERMEDIATE | ADVANCED' })
  experienceLevel: ExperienceLevel;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: '2026-02-28T12:45:05+06:00', required: false })
  joined_at?: string;
}
