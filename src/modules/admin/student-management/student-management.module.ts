import { Module } from '@nestjs/common';
import { StudentManagementService } from './student-management.service';
import { StudentManagementController } from './student-management.controller';

@Module({
  controllers: [StudentManagementController],
  providers: [StudentManagementService],
})
export class StudentManagementModule {}
