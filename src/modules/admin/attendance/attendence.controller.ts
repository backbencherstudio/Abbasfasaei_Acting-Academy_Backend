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
}
