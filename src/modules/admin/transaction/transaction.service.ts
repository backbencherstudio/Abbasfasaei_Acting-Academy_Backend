import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FinanceAndPaymentsService } from './financeandpayments.helper';
import { FinanceService } from './finance.helper';

@Injectable()
export class TransactionService {
  private readonly financeService: FinanceService;
  private readonly financeAndPaymentsService: FinanceAndPaymentsService;

  constructor(private readonly prisma: PrismaService) {
    this.financeService = new FinanceService(prisma);
    this.financeAndPaymentsService = new FinanceAndPaymentsService(prisma);
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

  getFinanceDashboardData() {
    return this.financeAndPaymentsService.getFinanceDashboardData();
  }
}
