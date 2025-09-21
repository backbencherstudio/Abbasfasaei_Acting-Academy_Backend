import { Module } from '@nestjs/common';
import { CommunityManagementService } from './community-management.service';
import { CommunityManagementController } from './community-management.controller';

@Module({
  controllers: [CommunityManagementController],
  providers: [CommunityManagementService],
})
export class CommunityManagementModule {}
