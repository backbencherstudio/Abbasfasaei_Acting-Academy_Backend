import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getAllAttendance(query?: {
    status?: string;
    date?: string;
    classId?: string;
    courseId?: string;
    page?: string;
    limit?: string;
  }) {
    const whereClause: any = {};
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 10));
    const skip = (page - 1) * limit;

    if (query?.status) {
      const normalizedStatus = String(query.status).toUpperCase();
      const allowedStatuses = Object.values(AttendanceStatus);
      if (!allowedStatuses.includes(normalizedStatus as AttendanceStatus)) {
        return {
          success: false,
          message: `Invalid status filter. Allowed values: ${allowedStatuses.join(', ')}`,
        };
      }
      whereClause.status = normalizedStatus as AttendanceStatus;
    }

    if (query?.date) {
      const parsedDate = new Date(query.date);
      if (Number.isNaN(parsedDate.getTime())) {
        return {
          success: false,
          message: 'Invalid date filter',
        };
      }
      const year = parsedDate.getFullYear();
      const month = parsedDate.getMonth();

      whereClause.attended_at = {
        gte: new Date(year, month, 1),
        lt: new Date(year, month + 1, 1),
      };
    }

    if (query?.classId) {
      const moduleClass = await this.prisma.moduleClass.findUnique({
        where: { id: query.classId },
        select: { id: true },
      });

      if (!moduleClass) {
        return {
          success: false,
          message: 'Class not found',
        };
      }

      whereClause.class_id = query.classId;
    }

    if (query?.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: query.courseId },
        select: { id: true },
      });

      if (!course) {
        return {
          success: false,
          message: 'Course not found',
        };
      }

      whereClause.class = {
        module: {
          courseId: query.courseId,
        },
      };
    }

    const [filteredAttendance, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              avatar: true,
            },
          },
          class: {
            select: {
              id: true,
              class_title: true,
              class_time: true,
              module: {
                select: {
                  id: true,
                  module_title: true,
                  course: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { attended_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.attendance.count({ where: whereClause }),
    ]);

    return {
      success: true,
      message: 'Attendance fetched successfully',
      data: filteredAttendance,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async generateClassQR(classId: string, teacherId: string) {
    if (!classId) {
      throw new BadRequestException('Class ID is required');
    }

    if (!teacherId) {
      throw new BadRequestException('Teacher ID is required');
    }

    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        name: true,
        role_users: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const isTeacher = teacher.role_users.some(
      (roleUser) => roleUser.role?.name?.toUpperCase() === 'TEACHER',
    );

    if (!isTeacher) {
      throw new ForbiddenException('Only teachers can generate QR codes');
    }

    const moduleClass = await this.prisma.moduleClass.findUnique({
      where: { id: classId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!moduleClass) {
      throw new NotFoundException('Class not found');
    }

    if (moduleClass.module.course.instructorId !== teacherId) {
      throw new ForbiddenException('You are not assigned to this course/class');
    }

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
            id: true,
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
