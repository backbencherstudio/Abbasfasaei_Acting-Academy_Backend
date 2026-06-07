import { Module } from '@nestjs/common';
import { OverviewModule } from './overview/overview.module';
import { CourseModule } from './course/course.module';
import { EventModule } from './event/event.module';
import { CommunityModule } from './community/community.module';
import { UserModule } from './user/user.module';
import { TransactionModule } from './transaction/transaction.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    OverviewModule,
    CourseModule,
    EventModule,
    CommunityModule,
    UserModule,
    TransactionModule,
    SettingsModule,
  ],
})
export class AdminModule {}
