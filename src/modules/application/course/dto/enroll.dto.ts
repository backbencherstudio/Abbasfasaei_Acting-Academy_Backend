import { ExperienceLevel } from '@prisma/client';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class EnrollDto {
  course_type: string; // CourseType enum
  full_name: string;
  email: string;
  phone: string;
  address: string;
  date_of_birth: string; // ISO string
  experience_level: ExperienceLevel;
  acting_goals: string;

  // Rules & Terms
  rules_accepted: boolean;
  terms_accepted: boolean;

  // Digital Signature
  signature_full_name: string;
  signature: string;
  signature_date: string; // ISO string

  // Payment
  payment_type: 'ONE_TIME' | 'MONTHLY'; // PaymentType enum
  // payment_status: 'PENDING' | 'COMPLETED' | 'FAILED'; // PaymentStatus enum
  // payment_method?: string = 'CARD';
  account_holder: string;
  card_number: string;
  card_expiry: string;
  card_cvc: string;
}
export class PInfoDto {
  @IsNotEmpty()
  @IsString()
  course_type: string;

  @IsNotEmpty()
  @IsString()
  full_name: string;

  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  date_of_birth: string;

  @IsNotEmpty()
  @IsString()
  experience_level: ExperienceLevel;

  @IsNotEmpty()
  @IsString()
  acting_goals: string;
}

export class AcceptRulesOrContractDto {
  @IsNotEmpty()
  @IsString()
  full_name: string;
  @IsNotEmpty()
  @IsString()
  digital_signature: string;

  @IsNotEmpty()
  @IsString()
  digital_signature_date: string;

  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value === 'true' : value,
  )
  @Equals(true)
  @IsBoolean()
  accepted: boolean;
}
