import { PostStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  limit?: number;
}

export class QueryCommunityDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? value?.toUpperCase() : undefined))
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? value?.toUpperCase() : undefined))
  @IsEnum(['ADMIN', 'STUDENT'])
  role?: 'ADMIN' | 'STUDENT';
}
