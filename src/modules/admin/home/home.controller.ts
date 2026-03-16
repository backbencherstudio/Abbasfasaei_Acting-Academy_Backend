import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HomeService } from './home.service';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('admin/home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getHome(@GetUser() user: any) {
    return this.homeService.getHome(user.userId);
  }
}
