import { Controller, Get } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { ApiResponse } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('finance')
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @ApiResponse({description: 'Finance Dashboard Data'})
  @Get('dashboard')
  async getDashboard(
    @GetUser() user: any,
  ) {
    return this.finance.getDashboardData(user.userId);
  }
}
