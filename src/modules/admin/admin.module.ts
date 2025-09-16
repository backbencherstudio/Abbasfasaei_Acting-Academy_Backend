import { Module } from '@nestjs/common';
import { FaqModule } from './faq/faq.module';
import { ContactModule } from './contact/contact.module';
import { WebsiteInfoModule } from './website-info/website-info.module';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { StudentManagementModule } from './student-management/student-management.module';

@Module({
  imports: [
    FaqModule,
    ContactModule,
    WebsiteInfoModule,
    UserModule,
    NotificationModule,
    StudentManagementModule,
  ],
})
export class AdminModule {}
