import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PostType } from '@prisma/client';

export class CreateCommunityDto {
  @IsOptional()
  @IsEnum(PostType)
  post_type: PostType = PostType.POST;

  @ApiProperty({ example: 'This is my first post!' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  poll_options?: string[];
}
