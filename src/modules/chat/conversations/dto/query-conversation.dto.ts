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
  search?: string;

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
  @Transform(({ value }) => {
    if (typeof value !== 'string') return undefined;
    const key = value.toUpperCase();
    return key in MemberRole
      ? MemberRole[key as keyof typeof MemberRole]
      : undefined;
  })
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
  @Transform(({ value }) => {
    if (typeof value !== 'string') return undefined;
    const key = value.toUpperCase();
    return key in ATTACHMENT_TYPE
      ? ATTACHMENT_TYPE[key as keyof typeof ATTACHMENT_TYPE]
      : undefined;
  })
  @IsEnum(ATTACHMENT_TYPE)
  type?: ATTACHMENT_TYPE;
}
