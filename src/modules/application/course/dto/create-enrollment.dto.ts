import { ApiProperty } from '@nestjs/swagger';
import { EnrollmentStep } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsString,
  IsEnum,
  ValidateIf,
  IsOptional
} from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ enum: EnrollmentStep, example: EnrollmentStep.FORM_FILLING })
  @IsNotEmpty()
  @IsEnum(EnrollmentStep)
  step: EnrollmentStep;

  // --- STEP: FORM_FILLING FIELDS ---
  @ValidateIf((o) => o.step === EnrollmentStep.FORM_FILLING)
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty({ message: 'Name is required during form filling' })
  @IsString()
  name: string;

  @ValidateIf((o) => o.step === EnrollmentStep.FORM_FILLING)
  @ApiProperty({ example: 'john@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail()
  email: string;

  @ValidateIf((o) => o.step === EnrollmentStep.FORM_FILLING)
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ValidateIf((o) => o.step === EnrollmentStep.FORM_FILLING)
  @IsNotEmpty()
  @IsString()
  address: string;

  @ValidateIf((o) => o.step === EnrollmentStep.FORM_FILLING)
  @IsNotEmpty()
  @IsISO8601()
  date_of_birth: string;

  @ValidateIf((o) => o.step === EnrollmentStep.FORM_FILLING)
  @IsOptional()
  @IsString()
  experience?: string;

  @ValidateIf((o) => o.step === EnrollmentStep.FORM_FILLING)
  @IsOptional()
  @IsString()
  acting_goals?: string;

  // --- STEP: RULES_SIGNING FIELDS ---
  @ValidateIf((o) => o.step === EnrollmentStep.RULES_SIGNING)
  @ApiProperty({ example: true })
  @Type(() => Boolean)
  @IsBoolean()
  @Equals(true, { message: 'You must accept the rules' })
  rules_accepted: boolean;

  // --- STEP: CONTRACT_SIGNING FIELDS ---
  @ValidateIf((o) => o.step === EnrollmentStep.CONTRACT_SIGNING)
  @ApiProperty({ example: true })
  @Type(() => Boolean)
  @IsBoolean()
  @Equals(true, { message: 'You must accept the terms' })
  terms_accepted: boolean;


  // --- STEP: RULES_SIGNING AND CONTRACT_SIGNING FIELDS ---

  @ValidateIf((o) => o.step === EnrollmentStep.CONTRACT_SIGNING || o.step === EnrollmentStep.RULES_SIGNING)
  @IsNotEmpty()
  @IsString()
  signature_full_name: string;

  @ValidateIf((o) => o.step === EnrollmentStep.CONTRACT_SIGNING || o.step === EnrollmentStep.RULES_SIGNING)
  @IsNotEmpty()
  @IsString()
  signature: string;

  @ValidateIf((o) => o.step === EnrollmentStep.CONTRACT_SIGNING || o.step === EnrollmentStep.RULES_SIGNING)
  @IsNotEmpty()
  @IsISO8601()
  signature_date: string;
}
