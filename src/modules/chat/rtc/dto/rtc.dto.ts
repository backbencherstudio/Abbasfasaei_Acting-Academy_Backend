import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { CallKind } from '@prisma/client';

export class ConversationIdParamDto {
  @IsString()
  @IsNotEmpty()
  conversation_id: string;
}

export class StartCallDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(CallKind)
  kind?: CallKind = CallKind.VIDEO;
}

export class UpdateParticipantMediaDto {
  @IsOptional()
  @IsBoolean()
  camera?: boolean;

  @IsOptional()
  @IsBoolean()
  microphone?: boolean;

  @IsOptional()
  @IsBoolean()
  is_screen_sharing?: boolean;
}
