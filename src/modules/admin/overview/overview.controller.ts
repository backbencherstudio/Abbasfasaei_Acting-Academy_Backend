import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { OverviewService } from './overview.service';

@Controller('admin/overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getOverview(@GetUser('userId') user_id: string) {
    return this.overviewService.getOverview(user_id);
  }
}
