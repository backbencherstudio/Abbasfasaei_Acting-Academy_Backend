import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { OverviewService } from './overview.service';

@Controller()
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @UseGuards(JwtAuthGuard)
  @Get('admin/overview')
  async getDashboard(@GetUser() user: any) {
    return this.overviewService.getDashboardData(user?.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('admin/overview/home')
  async getHome(@GetUser() user: any) {
    return this.overviewService.getHome(user?.userId);
  }
}
