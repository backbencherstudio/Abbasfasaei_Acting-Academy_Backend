import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

enum PaymentType {
  all = 'ALL',
  oneTime = 'ONE_TIME',
  monthly = 'MONTHLY',
}

export class TransactionsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  limit?: number;

  @IsOptional()
  payment_type?: PaymentType;
}
