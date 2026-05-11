import { Test, TestingModule } from '@nestjs/testing';
import { CommunityManagementService } from './community-management.service';

describe('CommunityManagementService', () => {
  let service: CommunityManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommunityManagementService],
    }).compile();

    service = module.get<CommunityManagementService>(CommunityManagementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
