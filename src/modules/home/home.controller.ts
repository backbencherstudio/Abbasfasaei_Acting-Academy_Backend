import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HomeService } from './home.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) { }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getHome(
    @GetUser() user: any
    // @Param('id') id: string
  ) {
    return this.homeService.getHome(user.id)
  }
}
