import { PartialType } from '@nestjs/swagger';
import { CreateFinanceDto } from './create-transaction.dto';

export class UpdateFinanceDto extends PartialType(CreateFinanceDto) {}
