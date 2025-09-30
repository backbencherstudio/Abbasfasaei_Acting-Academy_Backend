import { Module } from '@nestjs/common';
import { FinanceAndPaymentsService } from './financeandpayments.service';
import { FinanceAndPaymentsController } from './financeandpayments.controller';

@Module({
  controllers: [FinanceAndPaymentsController],
  providers: [FinanceAndPaymentsService],
})
export class FinanceandpaymentsModule {}
