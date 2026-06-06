import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { FinanceService } from './finance.helper';
import { FinanceAndPaymentsService } from './financeandpayments.helper';
import { InstallmentAccessProcessor } from './processors/installment-access.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'installment-access-queue',
    }),
  ],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    FinanceService,
    FinanceAndPaymentsService,
    InstallmentAccessProcessor,
  ],
})
export class TransactionModule {}
