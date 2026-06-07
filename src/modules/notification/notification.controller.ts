import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(
    @GetUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.notificationService.findAll(userId, {
      page,
      limit,
      search,
    });
  }

  @Patch(':id/read')
  markRead(@GetUser('userId') userId: string, @Param('id') id: string) {
    return this.notificationService.markRead(id, userId);
  }

  @Patch('read-all')
  markAllRead(@GetUser('userId') userId: string) {
    return this.notificationService.markAllRead(userId);
  }

  @Delete(':id')
  remove(@GetUser('userId') userId: string, @Param('id') id: string) {
    return this.notificationService.remove(id, userId);
  }

  @Delete()
  removeAll(@GetUser('userId') userId: string) {
    return this.notificationService.removeAll(userId);
  }
}
