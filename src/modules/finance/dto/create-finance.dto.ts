import { ApiProperty } from '@nestjs/swagger';
import { ExperienceLevel } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFinanceDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  full_name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ example: 'BEGINNER | INTERMEDIATE | ADVANCED' })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel: ExperienceLevel;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: '2026-02-28T12:45:05+06:00', required: false })
  joined_at?: string;
}
