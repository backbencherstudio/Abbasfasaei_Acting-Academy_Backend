import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@DisAllowDeactivated()
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  
  // Student scans QR code to mark attendance
  @Post('scan-qr')
  async scanQR(
    @GetUser() user: any,
    @Body()
    body: any,
  ) {
    try {
      const token = body.token;
      const attendance = await this.attendanceService.qrscanner(
        token,
        user.userId,
      );

      return {
        success: true,
        message: 'Attendance marked successfully',
        data: attendance,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
