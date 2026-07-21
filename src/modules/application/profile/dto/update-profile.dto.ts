import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsBoolean()
  is_notification_enabled?: boolean;
}
