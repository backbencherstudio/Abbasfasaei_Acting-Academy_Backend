import { ConversationType, MemberRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class ConversationQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    ConversationType[value.toUpperCase()]
      ? ConversationType[value.toUpperCase()]
      : undefined,
  )
  @IsEnum(ConversationType)
  type?: ConversationType;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;
}

export class QueryGroupMembersDto {
  @IsOptional()
  @Transform(({ value }) =>
    MemberRole[value.toUpperCase()]
      ? MemberRole[value.toUpperCase()]
      : undefined,
  )
  @IsEnum(MemberRole)
  role?: MemberRole;
}

export enum ATTACHMENT_TYPE {
  MEDIA = 'media',
  FILE = 'file',
}

export class AttachmentsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) =>
    ATTACHMENT_TYPE[value.toUpperCase()]
      ? ATTACHMENT_TYPE[value.toUpperCase()]
      : undefined,
  )
  @IsEnum(ATTACHMENT_TYPE)
  type?: ATTACHMENT_TYPE;
}

enum userType {
  ALL = 'all',
  ADMIN = 'admin',
  TEACHER = 'teacher',
}

export class QueryDiscoverUsersDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    userType[value.toUpperCase()] ? userType[value.toUpperCase()] : 'all',
  )
  @IsEnum(userType)
  type?: userType;
}
