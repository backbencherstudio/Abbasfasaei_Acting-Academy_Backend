import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { OverviewService } from './overview.service';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@Controller('overview')
@DisAllowDeactivated()
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) { }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Get()
  async getOverview(@GetUser('userId') user_id: string) {
    return this.overviewService.getOverview(user_id);
  }
}
