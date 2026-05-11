import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
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
  @IsString()
  @ApiProperty({ example: 'Course Module Details' })
  course_module_details: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '6 weeks' })
  duration: string;

  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({ example: '2027-01-01' })
  start_date: Date;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Every Saturday 4 PM - 6 PM' })
  class_time: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'cmm5xlw8y0000kg30zwvz5s21' })
  instructorId: string;

  @IsNotEmpty()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  @ApiProperty({ example: 100 })
  fee: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Installment Process' })
  installment_process: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '100' })
  seat_capacity: string;
}
