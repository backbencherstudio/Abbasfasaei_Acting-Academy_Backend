import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { WebsiteInfoModule } from '../website-info/website-info.module';

@Module({
  imports: [WebsiteInfoModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
