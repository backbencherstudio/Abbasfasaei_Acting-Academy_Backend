import { ApiProperty } from '@nestjs/swagger';
import { PostType, PostVisibility } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreatePostDto {
  @IsOptional()
  @IsEnum(PostType)
  post_type: PostType = PostType.POST;

  @ApiProperty({ example: 'This is my first post!' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @ValidateIf((object) => object.postType === PostType.POLL)
  @IsArray()
  @IsString({ each: true })
  poll_options?: string[];

  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility = PostVisibility.PUBLIC;

  @IsOptional()
  @ValidateIf((object) => object.visibility === PostVisibility.FRIENDS)
  @IsArray()
  @IsString({ each: true })
  friends_ids?: string[];
}

export class CommentPostDto {
  content: string;
}

export class LikePostDto {
  postId: string;
  userId: string;
}

export class SharePostDto {
  postId: string;
  userId: string;
}
