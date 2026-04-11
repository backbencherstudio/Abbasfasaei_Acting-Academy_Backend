import { Controller } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@Controller('dashboard')
@DisAllowDeactivated()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
}
