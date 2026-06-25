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
import { QueryNotificationDto } from './dto/query-notification.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(
    @GetUser('userId') userId: string,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationService.findAll(userId, query);
  }

  @Patch(':notification_id/read')
  markRead(
    @GetUser('userId') userId: string,
    @Param('notification_id') notification_id: string,
  ) {
    return this.notificationService.markRead(notification_id, userId);
  }

  @Patch('read_all')
  markAllRead(@GetUser('userId') userId: string) {
    return this.notificationService.markAllRead(userId);
  }

  @Delete(':notification_id')
  remove(@GetUser('userId') userId: string, @Param('id') id: string) {
    return this.notificationService.remove(id, userId);
  }

  @Delete()
  removeAll(@GetUser('userId') userId: string) {
    return this.notificationService.removeAll(userId);
  }
}
