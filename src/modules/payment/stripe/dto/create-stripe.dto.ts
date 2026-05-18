import { IsOptional, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  @IsOptional()
  enrollmentId?: string;

  @IsString()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsOptional()
  currency?: string = 'usd';
}
