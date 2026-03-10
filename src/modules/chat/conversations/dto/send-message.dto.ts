import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { MessageKind } from '@prisma/client';
import { Transform } from 'class-transformer';

export class SendMessageDto {
  @IsEnum(MessageKind)
  @IsOptional()
  kind?: MessageKind = MessageKind.TEXT;

  @IsObject()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  content?: Record<string, any>;

  @IsOptional()
  @IsString()
  media_Url?: string;
}