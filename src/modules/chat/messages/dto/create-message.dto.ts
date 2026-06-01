import { MessageKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class ReportMessageDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class SendMessageDto {
  @IsEnum(MessageKind)
  @IsOptional()
  kind?: MessageKind = MessageKind.TEXT;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  reply_to_id?: string;
}
