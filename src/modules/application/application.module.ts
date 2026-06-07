import { Module } from '@nestjs/common';
import { OverviewModule } from './overview/overview.module';
import { CourseModule } from './course/course.module';
import { EventModule } from './event/event.module';
import { CommunityModule } from './community/community.module';
import { ProfileModule } from './profile/profile.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';

@Module({
  imports: [
    OverviewModule,
    CourseModule,
    EventModule,
    CommunityModule,
    ProfileModule,
    ContactModule,
    FaqModule,
  ],
})
export class ApplicationModule {}
