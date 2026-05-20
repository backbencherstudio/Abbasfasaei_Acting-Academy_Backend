import { PartialType } from '@nestjs/mapped-types';
import { CreateCommunityDto } from './create-community.dto';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { PostStatus } from '@prisma/client';

export class UpdateCommunityDto extends PartialType(CreateCommunityDto) {}

export class UpdateCommunityStatusDto {
  @IsNotEmpty()
  @IsEnum(PostStatus)
  status: PostStatus;
}
