import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum PaymentType {
  all = 'ALL',
  oneTime = 'ONE_TIME',
  monthly = 'MONTHLY',
}

export class TransactionsQueryDto {
  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Limit per page', default: 10 })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by payment type',
    enum: PaymentType,
    example: PaymentType.oneTime,
  })
  @IsOptional()
  @Transform(({ value }) => value?.toUpperCase())
  @IsEnum(PaymentType)
  payment_type?: PaymentType;

  @ApiPropertyOptional({ description: 'Date to filter by' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;
}
