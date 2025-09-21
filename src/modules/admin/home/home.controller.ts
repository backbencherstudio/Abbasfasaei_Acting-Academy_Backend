import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HomeService } from './home.service';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) { }

  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getHome(
    // @GetUser() user: any
    @Param('id') id: string
  ) {
    return this.homeService.getHome(id)
  }
}
