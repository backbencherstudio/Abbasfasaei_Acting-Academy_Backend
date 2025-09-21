import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendence.service';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @ApiResponse({ description: 'Get All Attendance' })
  @Get()
  async getAllAttendance(@Query() query: { status?: string; date?: string }) {
    const { status, date } = query;
    return this.attendanceService.getAllAttendance(status, date);
  }

  //generate qr for teacher
  @Post('generate-qr/:classId')
  async generateQR(@GetUser() user: any, @Param('classId') classId: string) {
    try {
      const teacherId = user.userId;

      const qrData = await this.attendanceService.generateClassQR(
        classId,
        teacherId,
      );

      return {
        success: true,
        message: 'QR code generated successfully. Valid for 1 hour.',
        data: qrData,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error generating QR code',
        error: error.message,
      };
    }
  }

  // Student scans QR code to mark attendance
  @Post('scan-qr')
  async scanQR(
    @GetUser() user: any,
    @Body()
    body: any,
  ) {
    try {
      const token = body.token
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
