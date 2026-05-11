import { ExperienceLevel } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CombinedEnrollmentDto {
  @IsNotEmpty()
  @IsString()
  courseId: string;

  @IsNotEmpty()
  @IsString()
  full_name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  date_of_birth?: string;

  @IsNotEmpty()
  @IsEnum(ExperienceLevel)
  experience_level: ExperienceLevel;

  @IsNotEmpty()
  @IsString()
  acting_goals: string;

  // Payment Info
  @IsNotEmpty()
  @IsString()
  transaction_id?: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string = 'usd';

  @IsNotEmpty()
  @IsString()
  payment_date?: string;

  //   no need
  @IsOptional()
  @IsString()
  payment_status?: string = 'PAID';

  @IsOptional()
  @IsString()
  payment_type?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  account_holder?: string;

  @IsOptional()
  @IsString()
  card_number?: string;

  @IsOptional()
  @IsString()
  card_expiry?: string;

  @IsOptional()
  @IsString()
  invoice_sent?: string;
}
