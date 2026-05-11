import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { ContactModule } from '../contact/contact.module';
import { FaqModule } from '../faq/faq.module';
import { WebsiteInfoModule } from '../website-info/website-info.module';

@Module({
  imports: [WebsiteInfoModule, ContactModule, FaqModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
