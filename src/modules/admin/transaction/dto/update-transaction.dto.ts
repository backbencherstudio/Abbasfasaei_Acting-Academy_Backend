import { PartialType } from '@nestjs/swagger';
import { CreateManualPaymentDto } from './create-transaction.dto';

export class UpdateManualPaymentDto extends PartialType(
  CreateManualPaymentDto,
) {}
