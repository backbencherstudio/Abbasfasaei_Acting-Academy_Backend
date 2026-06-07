import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CreateManualPaymentDto } from './dto/create-transaction.dto';
import { TransactionsQueryDto } from './dto/query-transaction.dto';
import { TransactionService } from './transaction.service';

@Controller('admin/transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FINANCE)
  @Get('stats')
  @ApiResponse({ description: 'Get revenue stats' })
  getStats() {
    return this.transactionService.getStats();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FINANCE, Role.ADMIN)
  @Get()
  @ApiResponse({ description: 'Get all transactions' })
  getAllTransactions(@Query() query: TransactionsQueryDto) {
    return this.transactionService.getAllTransactions(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.FINANCE)
  @Post('admin/transactions/payments/manual')
  @ApiResponse({ description: 'Add manual payment' })
  addManualPayment(@Body() body: CreateManualPaymentDto) {
    return this.transactionService.addManualPayment(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.FINANCE)
  @Post('admin/transactions/installments/suspend-overdue')
  @ApiResponse({ description: 'Suspend enrollments with overdue installments' })
  suspendOverdueInstallmentAccess() {
    return this.transactionService.suspendOverdueInstallmentAccess();
  }

  @Get('finance-and-payments')
  @DisAllowDeactivated()
  async getFinanceDashboard() {
    try {
      const data = await this.transactionService.getFinanceDashboardData();
      return { success: true, data };
    } catch {
      return {
        success: false,
        message: 'Error fetching finance dashboard data',
      };
    }
  }
}
