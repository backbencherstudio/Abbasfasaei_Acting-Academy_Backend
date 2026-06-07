import { IsOptional, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  @IsOptional()
  enrollment_id?: string;

  @IsString()
  @IsOptional()
  event_id?: string;

  @IsString()
  @IsOptional()
  currency?: string = 'usd';
}
