import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEmail,
  IsString,
} from 'class-validator';
import { Role } from 'src/common/guard/role/role.enum';

export class CreateUserDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'The name of the user',
    example: 'John Doe',
  })
  name: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'The email of the user',
    example: 'john.doe@example.com',
  })
  email: string;

  @IsOptional()
  @ApiProperty({
    description: 'The phone of the user',
    example: '1234567890',
  })
  phone?: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'The password of the user',
    example: 'password',
  })
  password: string;

  @IsOptional()
  @ApiProperty({
    description: 'The type of the user',
    enum: Role,
    example: Role.USER,
  })
  @Transform(({ value }) => value?.trim()?.toLowerCase())
  @IsEnum(Role)
  type?: Role;

  @IsOptional()
  @ApiProperty({
    description: 'The join date of the user',
    example: '2022-01-01',
  })
  @Type(() => Date)
  @IsDate()
  join_date?: Date;

  @IsOptional()
  @ApiProperty({
    description: 'The experience of the user',
    example: '5 years',
  })
  experience?: string;
}

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
  @IsString()
  experience_level: string;

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

export class CreateStudentManagementDto {}

export class CreateTeacherDto {
  // User Basic Info
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'teacher' })
  name: string;

  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({ example: 'teacher@gmail.com' })
  email: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '225 555 0118' })
  phone_number: string;

  // Teacher Specific Info
  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'Active' })
  teacherType: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'kjhrf12323', required: false })
  courseId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'teacher123', required: false })
  password?: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'BEGINNER | INTERMEDIATE | ADVANCED' })
  experienceLevel: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: '2026-02-28T12:45:05+06:00', required: false })
  joined_at?: string;
}

export class PaymentDto {
  transaction_id: string;
  payment_date: string; // ISO string
  amount: number;
}

export enum AssignableUserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export class SetUserRoleDto {
  @ApiProperty({ enum: AssignableUserRole, description: 'Role to assign' })
  @IsEnum(AssignableUserRole)
  role: AssignableUserRole;
}
