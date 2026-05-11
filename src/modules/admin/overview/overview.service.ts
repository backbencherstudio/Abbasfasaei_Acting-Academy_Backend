import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DashboardService } from './dashboard.helper';
import { HomeService } from './home.helper';

@Injectable()
export class OverviewService {
  private readonly dashboardService: DashboardService;
  private readonly homeService: HomeService;

  constructor(private readonly prisma: PrismaService) {
    this.dashboardService = new DashboardService(prisma);
    this.homeService = new HomeService(prisma);
  }

  getDashboardData(userId: string) {
    return this.dashboardService.getDashboardData(userId);
  }

  getHome(userId: string) {
    return this.homeService.getHome(userId);
  }
}
