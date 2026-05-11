import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DashboardService } from './dashboard.helper';
import { HomeService } from './home.helper';

@Injectable()
export class OverviewService {
  private readonly dashboardService: DashboardService;
  private readonly homeService: HomeService;

  constructor(private readonly prisma: PrismaService) {
    this.dashboardService = new DashboardService();
    this.homeService = new HomeService(prisma);
  }

  getDashboard() {
    return this.dashboardService;
  }

  getHome(userId: string) {
    return this.homeService.getHome(userId);
  }
}
