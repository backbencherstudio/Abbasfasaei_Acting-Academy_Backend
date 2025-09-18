import { Injectable } from '@nestjs/common';
import { CreateAttendenceDto } from './dto/create-attendence.dto';
import { UpdateAttendenceDto } from './dto/update-attendence.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getAllAttendance(status?: string, date?: string) {
    const whereClause: any = {};  // Initial empty where clause

    if (status) {
      whereClause.status = status; // Filter by status if provided
    }

    if (date) {
      const parsedDate = new Date(date);
      const year = parsedDate.getFullYear();
      const month = parsedDate.getMonth();

      // Filter by month and year in attended_at field
      whereClause.attended_at = {
        gte: new Date(year, month, 1), // Start of the month
        lt: new Date(year, month + 1, 1), // Start of next month (exclusive)
      };
    }

    // Fetch the filtered attendance records from Prisma
    const filteredAttendance = await this.prisma.attendance.findMany({
      where: whereClause,
    });

    return filteredAttendance;
  }

  async updateAttendance(studentId: string, updateAttendanceDto: UpdateAttendenceDto) {

    
  }

}
