import { Module } from '@nestjs/common';
import { NotificationModule as AdminNotificationModule } from './admin/notification.module';
import { NotificationModule as ApplicationNotificationModule } from './application/notification.module';

@Module({
  imports: [ApplicationNotificationModule, AdminNotificationModule],
})
export class RootNotificationModule {}
