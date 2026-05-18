import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { MessageKind } from '@prisma/client';
import { ConversationType } from '@prisma/client';
import { ValidateIf } from 'class-validator';

export class CreateConversationDto {
  @IsNotEmpty()
  @IsEnum(ConversationType)
  type: ConversationType;

  @ValidateIf((o) => o.type === ConversationType.DM)
  @IsNotEmpty()
  @IsString()
  participant_id?: string;

  @ValidateIf((o) => o.type === ConversationType.GROUP)
  @IsNotEmpty()
  @IsString()
  title?: string;

  @ValidateIf((o) => o.type === ConversationType.GROUP)
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participant_ids?: string[];
}

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
