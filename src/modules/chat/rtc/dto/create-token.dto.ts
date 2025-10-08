import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateTokenDto {
  @IsString()
  userId: string; // authenticated user id (identity in LiveKit)

  @IsOptional()
  @IsString()
  roomName?: string; // optional explicit room name

  @IsOptional()
  @IsString()
  displayName?: string; // friendly display name

  @IsOptional()
  @IsBoolean()
  audioOnly?: boolean; // hint to client

  @IsOptional()
  @IsString()
  courseIdOrContextId?: string; // optional context scope (future auditing)
}
