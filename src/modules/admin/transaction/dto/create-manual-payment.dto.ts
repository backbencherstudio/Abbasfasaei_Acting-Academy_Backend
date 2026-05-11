import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ItemType,
  OrderStatus,
  PaymentType,
  TransactionStatus,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateManualPaymentDto {
  @ApiProperty({ example: 'student_user_id' })
  @IsString()
  @IsNotEmpty()
  studentId: string;

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

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.COMPLETED })
  @IsOptional()
  @IsEnum(OrderStatus)
  paymentStatus?: OrderStatus;

  @ApiPropertyOptional({ enum: TransactionStatus, example: TransactionStatus.SUCCESS })
  @IsOptional()
  @IsEnum(TransactionStatus)
  transactionStatus?: TransactionStatus;

  @ApiPropertyOptional({ enum: ItemType, example: ItemType.COURSE_ENROLLMENT })
  @IsOptional()
  @IsEnum(ItemType)
  itemType?: ItemType;

  @ApiPropertyOptional({ example: 'course_id' })
  @ValidateIf((dto) => dto.itemType === ItemType.COURSE_ENROLLMENT || !dto.itemType)
  @IsNotEmpty()
  @IsString()
  courseId?: string;

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