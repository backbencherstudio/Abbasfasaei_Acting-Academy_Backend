import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { AttendanceService } from './attendence.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { ApiResponse } from '@nestjs/swagger';


@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @ApiResponse({ description: 'Get All Attendance' })
  @Get()
  async getAllAttendance(
    @Query() query: { status?: string; date?: string },
  ) {
    const { status, date } = query;
    return this.attendanceService.getAllAttendance(status, date);
  }
}
