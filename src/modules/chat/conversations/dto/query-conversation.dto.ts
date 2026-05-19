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
