import { Module } from '@nestjs/common';
import { CommunityManagementModule } from './community-management.module';

@Module({
  imports: [CommunityManagementModule],
})
export class CommunityModule {}
