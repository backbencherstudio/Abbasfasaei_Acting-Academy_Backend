import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { FinanceAndPaymentsService } from './financeandpayments.helper';
import { FinanceService } from './finance.helper';

@Injectable()
export class TransactionService implements OnModuleInit {
  constructor(
    private readonly financeService: FinanceService,
    private readonly financeAndPaymentsService: FinanceAndPaymentsService,
    @InjectQueue('installment-access-queue')
    private readonly installmentAccessQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.installmentAccessQueue.add(
      'suspendOverdueInstallments',
      {},
      {
        jobId: 'suspend-overdue-installments-startup',
        removeOnComplete: true,
        removeOnFail: 25,
      },
    );

    await this.installmentAccessQueue.add(
      'suspendOverdueInstallments',
      {},
      {
        jobId: 'suspend-overdue-installments-hourly',
        repeat: { every: 60 * 60 * 1000 },
        removeOnComplete: true,
        removeOnFail: 25,
      },
    );
  }

  register(body: any) {
    return this.financeService.register(body);
  }

  update(body: any) {
    return this.financeService.update(body);
  }

  getStats() {
    return this.financeService.getStats();
  }

  getAllTransactions(query: any) {
    return this.financeService.getAllTransactions(query);
  }

  addManualPayment(body: any) {
    return this.financeService.addManualPayment(body);
  }

  suspendOverdueInstallmentAccess() {
    return this.financeService.suspendOverdueInstallmentAccess();
  }

  getFinanceDashboardData() {
    return this.financeAndPaymentsService.getFinanceDashboardData();
  }
}
