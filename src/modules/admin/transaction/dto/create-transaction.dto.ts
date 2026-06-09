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
  @ApiProperty({ example: 'student_user_id' })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiPropertyOptional({ example: 'enrollment_id' })
  @IsOptional()
  @IsString()
  enrollmentId?: string;

  @ApiProperty({ example: 2500 })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'stripe', default: 'stripe' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'TXN-2026-001' })
  @IsOptional()
  @IsString()
  transactionRef?: string;

  @ApiPropertyOptional({ enum: PaymentType, example: PaymentType.ONE_TIME })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PAID })
  @IsOptional()
  @IsEnum(OrderStatus)
  paymentStatus?: OrderStatus;

  @ApiPropertyOptional({
    enum: PaymentTransactionStatus,
    example: PaymentTransactionStatus.SUCCESS,
  })
  @IsOptional()
  @IsEnum(PaymentTransactionStatus)
  transactionStatus?: PaymentTransactionStatus;

  @ApiPropertyOptional({ enum: ItemType, example: ItemType.COURSE_ENROLLMENT })
  @IsOptional()
  @IsEnum(ItemType)
  itemType?: ItemType;

  @ApiPropertyOptional({ example: 'course_id' })
  @ValidateIf(
    (dto) =>
      (dto.itemType === ItemType.COURSE_ENROLLMENT || !dto.itemType) &&
      !dto.enrollmentId,
  )
  @IsNotEmpty()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({
    example: 6,
    description: 'Required when creating a new installment plan',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  installmentCount?: number;

  @ApiPropertyOptional({
    example: ['2026-07-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'],
    description: 'Due dates for a new installment plan',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsDateString({}, { each: true })
  installmentDueDates?: string[];

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
  installmentNumbers?: number[];

  @ApiPropertyOptional({ example: 'event_id' })
  @ValidateIf((dto) => dto.itemType === ItemType.EVENT_TICKET)
  @IsNotEmpty()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({ example: '2026-04-11T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'Manual entry by finance team' })
  @IsOptional()
  @IsString()
  notes?: string;
}
