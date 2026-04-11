import { Controller, Get, Query } from '@nestjs/common';
import { FinanceAndPaymentsService, FinanceDashboardData } from './financeandpayments.service';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@Controller('finance-and-payments')
@DisAllowDeactivated()
export class FinanceAndPaymentsController {
  constructor(private readonly financeService: FinanceAndPaymentsService) {}

  @Get()
  async getFinanceDashboard(): Promise<{ success: boolean; data?: FinanceDashboardData; message?: string }> {
    try {
      const dashboardData = await this.financeService.getFinanceDashboardData();
      return {
        success: true,
        data: dashboardData,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching finance dashboard data',
      };
    }
  }
}
