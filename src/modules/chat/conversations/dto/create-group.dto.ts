import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';
export class CreateGroupDto {
  @IsString()
  title: string;

  @IsArray()
  @ArrayMinSize(1)
  memberIds: string[];

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
