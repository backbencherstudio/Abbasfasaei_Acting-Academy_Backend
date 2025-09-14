import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { MessageKind } from '@prisma/client';

export class SendMessageDto {
  @IsEnum(MessageKind)
  @IsOptional()
  kind?: MessageKind = MessageKind.TEXT;

  @IsObject()
  @IsOptional()
  content?: Record<string, any>; // <-- Make sure @IsOptional() is present

  @IsOptional()
  @IsString()
  media_Url?: string;
}