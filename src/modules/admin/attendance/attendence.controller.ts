import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import { AttendanceService } from './attendence.service';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TEACHER)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  //generate qr for teacher
  @Post('generate-qr/:classId')
  async generateQR(@GetUser() user: any, @Param('classId') classId: string) {
    try {
      const teacherId = user?.userId;
      console.log(teacherId);

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

  @ApiResponse({ description: 'Get All Attendance' })
  @Get()
  async getAllAttendance(
    @Query()
    query: {
      status?: string;
      date?: string;
      classId?: string;
      courseId?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    return this.attendanceService.getAllAttendance(query);
  }

  @ApiResponse({ description: 'Mark manual attendance' })
  @Post('manual')
  async markManualAttendance(
    @GetUser() user: any,
    @Body()
    body: {
      classId?: string;
      studentId?: string;
      status?: string;
      attendedAt?: string;
    },
  ) {
    return this.attendanceService.markManualAttendance(body, user?.userId);
  }
}
