import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { ApiResponse } from '@nestjs/swagger';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { CreateFinanceDto } from './dto/create-finance.dto';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { UpdateFinanceDto } from './dto/update-finance.dto';
import { TransactionsQueryDto } from './dto/query-finance.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private finance: FinanceService) {}

  // @ApiResponse({ description: 'Finance Dashboard Data' })
  // @Get('dashboard')
  // async getDashboard(@GetUser() user: any) {
  //   return this.finance.getDashboardData(user.userId);
  // }

  @Roles(Role.ADMIN)
  @Post('register')
  @ApiResponse({ description: 'Register finance' })
  async register(@Body() body: CreateFinanceDto) {
    return this.finance.register(body);
  }

  @Roles(Role.ADMIN)
  @Post('update')
  @ApiResponse({ description: 'Update finance' })
  async update(@Body() body: UpdateFinanceDto) {
    return this.finance.update(body);
  }

  @Roles(Role.FINANCE)
  @ApiResponse({ description: 'Get revenue stats' })
  @Get('revenue/stats')
  async getStats() {
    return this.finance.getStats();
  }

  @Roles(Role.FINANCE)
  @ApiResponse({ description: 'Get all transactions' })
  @Get('transactions')
  async getAllTransactions(@Query() query: TransactionsQueryDto) {
    return this.finance.getAllTransactions(query);
  }

  @Roles(Role.FINANCE)
  @ApiResponse({ description: 'Add manual payment' })
  @Post('payments/manual')
  async addManualPayment(@Body() body: CreateManualPaymentDto) {
    return this.finance.addManualPayment(body);
  }
}
