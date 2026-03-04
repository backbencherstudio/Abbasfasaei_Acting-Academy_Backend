import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStripeDto {}

export class createPaymentIntent {
  @IsString()
  @IsOptional()
  enrollmentId?: string;

  @IsString()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsOptional()
  currency?: string = 'usd';

  @IsEnum(['ONE_TIME', 'MONTHLY'])
  @IsNotEmpty()
  payment_type: 'ONE_TIME' | 'MONTHLY' = 'ONE_TIME';
}
