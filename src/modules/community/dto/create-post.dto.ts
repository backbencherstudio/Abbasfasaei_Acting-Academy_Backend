import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @IsOptional()
  @IsEnum(['POST', 'POLL'])
  postType: 'POST' | 'POLL' = 'POST';

  @ApiProperty({ example: 'This is my first post!' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsEnum(['PHOTO', 'VIDEO'])
  mediaType?: 'PHOTO' | 'VIDEO';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pollOptions?: string[];

  @IsOptional()
  @IsEnum(['PUBLIC', 'PRIVATE', 'FRIENDS'])
  visibility?: 'PUBLIC' | 'PRIVATE' | 'FRIENDS' = 'PUBLIC';
}
