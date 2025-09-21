import { Module } from '@nestjs/common';
import { AttendanceService } from './attendence.service';
import { AttendanceController } from './attendence.controller';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendenceModule {}
