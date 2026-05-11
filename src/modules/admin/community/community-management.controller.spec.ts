import { Test, TestingModule } from '@nestjs/testing';
import { CommunityManagementController } from './community-management.controller';
import { CommunityManagementService } from './community-management.service';

describe('CommunityManagementController', () => {
  let controller: CommunityManagementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityManagementController],
      providers: [CommunityManagementService],
    }).compile();

    controller = module.get<CommunityManagementController>(CommunityManagementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
