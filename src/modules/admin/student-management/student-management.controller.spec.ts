import { Test, TestingModule } from '@nestjs/testing';
import { StudentManagementController } from './student-management.controller';
import { StudentManagementService } from './student-management.service';

describe('StudentManagementController', () => {
  let controller: StudentManagementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentManagementController],
      providers: [StudentManagementService],
    }).compile();

    controller = module.get<StudentManagementController>(StudentManagementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
