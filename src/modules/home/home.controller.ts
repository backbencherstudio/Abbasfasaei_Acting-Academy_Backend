import { Controller, Get, Param } from '@nestjs/common';
import { HomeService } from './home.service';

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
