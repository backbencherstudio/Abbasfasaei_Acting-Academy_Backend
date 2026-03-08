import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { ApiResponse } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { CreateFinanceDto } from './dto/create-finance.dto';
import { UpdateFinanceDto } from './dto/update-finance.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @ApiResponse({ description: 'Finance Dashboard Data' })
  @Get('dashboard')
  async getDashboard(@GetUser() user: any) {
    return this.finance.getDashboardData(user.userId);
  }

  @Roles(Role.ADMIN)
  @Post('register')
  @ApiResponse({ description: 'Register finance' })
  async register(@Body() paymentData: CreateFinanceDto) {
    return this.finance.register(paymentData);
  }

  @Roles(Role.ADMIN)
  @Post('update')
  @ApiResponse({ description: 'Update finance' })
  async update(@Body() paymentData: UpdateFinanceDto) {
    return this.finance.update(paymentData);
  }
}
