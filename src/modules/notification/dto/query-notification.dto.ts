import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '../../../common/repository/notification/notification.repository';

export class QueryNotificationDto {
  @IsString()
  @IsOptional()
  cursor?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;

  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;
}
