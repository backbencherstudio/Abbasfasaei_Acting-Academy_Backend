import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateCourseDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Introduction to Acting' })
  title: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Course Overview' })
  course_overview: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ example: 100 })
  duration: number;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDateString()
  @ApiProperty({ example: '2027-01-01' })
  start_date: Date;

  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 4) {
        const hours = parseInt(digits.substring(0, 2), 10);
        const minutes = parseInt(digits.substring(2, 4), 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      }
      throw new Error('Invalid time format. Use HH:MM (e.g., "17:00").');
    }
    return value;
  })
  @IsString()
  @ApiProperty({ example: '17:00' })
  class_time: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'cmm5xlw8y0000kg30zwvz5s21' })
  instructor_id?: string;

  @IsNotEmpty()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  @ApiProperty({ example: 100 })
  fee_pence: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Installment Process' })
  installment_process: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ example: 100 })
  seat_capacity: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'write terms & conditions of the course' })
  contract: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'write rules & regulations of the course' })
  rules_regulations: string;
}
