import {
  Controller,
  Get,
  Param,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { HomeService } from './home.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getHome(
    @GetUser() user: any,
    // @Param('id') id: string
  ) {
    if (!user.userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.homeService.getHome(user.userId);
  }
}
