import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { InstallmentAccessProcessor } from './installment-access.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'installment-access-queue',
    }),
  ],
  controllers: [TransactionController],
  providers: [TransactionService, InstallmentAccessProcessor],
})
export class TransactionModule {}
