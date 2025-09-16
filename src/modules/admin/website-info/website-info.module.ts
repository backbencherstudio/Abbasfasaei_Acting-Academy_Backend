import { Module } from '@nestjs/common';
import { WebsiteInfoService } from './website-info.service';
import { WebsiteInfoController } from './website-info.controller';
import { SettingsService } from '../settings/settings.service';

@Module({
  controllers: [WebsiteInfoController],
  providers: [WebsiteInfoService],
  exports: [WebsiteInfoService],
})
export class WebsiteInfoModule {}
