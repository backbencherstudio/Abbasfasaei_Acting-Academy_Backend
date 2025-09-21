import { Controller, Get, Param } from '@nestjs/common';
import { HomeService } from './home.service';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) { }

  @Get()
  async getEnrols() {
    return this.homeService.getEnrols()
  }

  @Get()
  async getHome(
    @GetUser() user: any
  ) {
    return this.homeService.getHome(user.userId)
  }
}
