import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { OverviewService } from './overview.service';

@Controller('overview')
@DisAllowDeactivated()
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) { }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getHome(@GetUser() user: any) {
    return this.overviewService.getHome(user.userId);
  }
}
