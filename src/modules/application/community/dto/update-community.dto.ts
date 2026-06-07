import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreatePostDto } from './create-community.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {}

export class EditProfileDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  about: string;
}
