import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
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

export class MarkAsReadDto {
  @IsString()
  @IsNotEmpty()
  up_to_message_id: string;
}

export class AddMemberDto {
  @IsArray()
  @IsNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  member_ids: string[];
}

export enum ConversationSilentMode {
  OFF = 'off',
  FOREVER = 'forever',
  UNTIL = 'until',
}

export class UpdateConversationSilentDto {
  @IsEnum(ConversationSilentMode)
  mode: ConversationSilentMode;

  @ValidateIf((o) => o.mode === ConversationSilentMode.UNTIL)
  @IsNotEmpty()
  @IsDateString()
  until_at?: string;
}

export class CreateUserReportDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
