import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getAllAttendance(status?: string, date?: string) {
    const whereClause: any = {}; // Initial empty where clause

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

    return {
      success: true,
      message: 'Attendance fetched successfully',
      data: filteredAttendance,
    };
  }

  async generateClassQR(classId: string, teacherId: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Create QR session
    const qrSession = await this.prisma.qRAttendanceSession.create({
      data: {
        token,
        class_id: classId,
        created_by: teacherId,
        expires_at: expiresAt,
        is_active: true,
      },
      include: {
        class: {
          select: {
            class_title: true,
            class_time: true,
          },
        },
      },
    });

    // Generate QR code data
    const qrData = JSON.stringify({
      version: '1.0',
      type: 'attendance',
      classId,
      token,
      expires: expiresAt.toISOString(),
    });

    const qrCodeImage = await QRCode.toDataURL(qrData);

    return {
      qrCodeImage,
      token,
      sessionId: qrSession.id,
      expiresAt,
      class: qrSession.class,
    };
  }
}
