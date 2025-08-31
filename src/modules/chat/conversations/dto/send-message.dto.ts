import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { MessageKind } from '@prisma/client';

export class SendMessageDto {
  @IsEnum(MessageKind)
  @IsOptional()
  kind?: MessageKind = MessageKind.TEXT;

  @IsObject()
  content: Record<string, any>;
}
