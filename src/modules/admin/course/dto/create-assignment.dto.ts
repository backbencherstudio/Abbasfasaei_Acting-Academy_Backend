import { IsNotEmpty, IsNumber, Min, IsString, IsDate, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssignmentDto {
  @IsNotEmpty({ message: 'Assignment title is required' })
  @IsString()
  title: string;

  @IsNotEmpty({ message: 'Assignment description is required' })
  @IsString()
  description: string;

  @IsNotEmpty({ message: 'Submission date is required' })
  @Type(() => Date)
  @IsDate()
  submission_date: Date;

  @IsNotEmpty({ message: 'Total marks is required' })
  @IsNumber()
  @Min(0, { message: 'Total marks must be a non-negative number' })
  @Type(() => Number)
  total_marks: number;
}

export enum Grade {
  A_PLUS = 'A+',
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  F = 'F',
}

export class GradeAssignmentDto {
  @IsString()
  @IsOptional()
  @IsEnum(Grade)
  grade?: Grade;

  @IsString()
  @IsOptional()
  feedback?: string;

  @IsNumber()
  @IsOptional()
  grade_number?: number;
}
