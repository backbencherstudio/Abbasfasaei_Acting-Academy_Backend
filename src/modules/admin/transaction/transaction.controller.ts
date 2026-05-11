import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CreateFinanceDto } from './dto/create-finance.dto';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { TransactionsQueryDto } from './dto/query-finance.dto';
import { UpdateFinanceDto } from './dto/update-finance.dto';
import { TransactionService } from './transaction.service';

@Controller()
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/transactions/register')
  @ApiResponse({ description: 'Register finance' })
  register(@Body() body: CreateFinanceDto) {
    return this.transactionService.register(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/transactions/update')
  @ApiResponse({ description: 'Update finance' })
  update(@Body() body: UpdateFinanceDto) {
    return this.transactionService.update(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FINANCE)
  @Get('admin/transactions/revenue/stats')
  @ApiResponse({ description: 'Get revenue stats' })
  getStats() {
    return this.transactionService.getStats();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FINANCE)
  @Get('admin/transactions/transactions')
  @ApiResponse({ description: 'Get all transactions' })
  getAllTransactions(@Query() query: TransactionsQueryDto) {
    return this.transactionService.getAllTransactions(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FINANCE)
  @Post('admin/transactions/payments/manual')
  @ApiResponse({ description: 'Add manual payment' })
  addManualPayment(@Body() body: CreateManualPaymentDto) {
    return this.transactionService.addManualPayment(body);
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
