import { ApiProperty } from '@nestjs/swagger';
import { ExperienceLevel } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsEmail, IsNumber, IsDateString, IsString, IsEnum } from 'class-validator';

export class CreateTeacherDto {
  // User Basic Info
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Sophie Lambert' })
  name: string;

  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({ example: 'emmawitqnn@email.com' })
  email: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '225 555 0118' })
  phone_number: string;

  // Teacher Specific Info
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Active' })
  teacherType: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'kjhrf12323' })
  courseId: string;

  @IsNotEmpty()
  @IsEnum(ExperienceLevel)
  @ApiProperty({ example: 'BEGINNER | INTERMEDIATE | ADVANCED' })
  experienceLevel: ExperienceLevel;
}