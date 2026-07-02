import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ItemType,
  OrderStatus,
  PaymentTransactionStatus,
  PaymentType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateManualPaymentDto {
  @ApiPropertyOptional({ example: 'student_user_id' })
  @IsOptional()
  @IsString()
  student_id?: string;

  @ApiPropertyOptional({ example: 'enrollment_id' })
  @IsOptional()
  @IsString()
  enrollment_id?: string;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'stripe', default: 'stripe' })
  @IsOptional()
  @IsString()
  payment_method?: string;

  @ApiPropertyOptional({ example: 'TXN-2026-001' })
  @IsOptional()
  @IsString()
  transaction_ref?: string;

  @ApiPropertyOptional({ enum: PaymentType, example: PaymentType.ONE_TIME })
  @IsOptional()
  @IsEnum(PaymentType)
  payment_type?: PaymentType;

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PAID })
  @IsOptional()
  @IsEnum(OrderStatus)
  payment_status?: OrderStatus;

  @ApiPropertyOptional({
    enum: PaymentTransactionStatus,
    example: PaymentTransactionStatus.SUCCESS,
  })
  @IsOptional()
  @IsEnum(PaymentTransactionStatus)
  transaction_status?: PaymentTransactionStatus;

  @ApiPropertyOptional({ enum: ItemType, example: ItemType.COURSE_ENROLLMENT })
  @IsOptional()
  @IsEnum(ItemType)
  item_type?: ItemType;

  @ApiPropertyOptional({ example: 'course_id' })
  @ValidateIf(
    (dto) =>
      (dto.item_type === ItemType.COURSE_ENROLLMENT || !dto.item_type) &&
      !dto.enrollment_id,
  )
  @IsNotEmpty()
  @IsString()
  course_id?: string;

  @ApiPropertyOptional({
    example: [1, 2],
    description:
      'Installment numbers to mark paid. Omit to pay next due installments by amount.',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  installment_numbers?: number[];

  @ApiPropertyOptional({ example: 'event_id' })
  @ValidateIf((dto) => dto.item_type === ItemType.EVENT_TICKET)
  @IsNotEmpty()
  @IsString()
  event_id?: string;

  @ApiPropertyOptional({ example: '2026-04-11T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @ApiPropertyOptional({ example: 'Manual entry by finance team' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @IsString()
  card_last4?: string;

  @ApiPropertyOptional({ example: 'https://example.com/receipt.pdf' })
  @IsOptional()
  @IsString()
  receipt_url?: string;
}
