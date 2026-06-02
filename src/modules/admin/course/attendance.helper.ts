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

  async markManualAttendance(
    body: {
      classId?: string;
      studentId?: string;
      status?: string;
      attendedAt?: string;
    },
    actorUserId: string,
  ) {
    const classId = (body?.classId || '').trim();
    const studentId = (body?.studentId || '').trim();

    if (!classId) {
      throw new BadRequestException('Class ID is required');
    }

    if (!studentId) {
      throw new BadRequestException('Student ID is required');
    }

    if (!actorUserId) {
      throw new BadRequestException('User ID is required');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        id: true,
        role_users: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!actor) {
      throw new NotFoundException('User not found');
    }

    const roleNames = (actor.role_users || [])
      .map((ru) => ru?.role?.name)
      .filter(Boolean)
      .map((name) => String(name).toLowerCase());

    const isAdmin =
      roleNames.includes('admin') || roleNames.includes('su_admin');
    const isTeacher = roleNames.includes('teacher');

    if (!isAdmin && !isTeacher) {
      throw new ForbiddenException(
        'Only teacher, admin, or super admin can mark manual attendance',
      );
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

    if (
      isTeacher &&
      !isAdmin &&
      moduleClass.module.course.instructor_id !== actorUserId
    ) {
      throw new ForbiddenException('You are not assigned to this class/course');
    }

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        role_users: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const isStudent = (student.role_users || []).some(
      (ru) => ru?.role?.name?.toUpperCase() === 'STUDENT',
    );

    if (!isStudent) {
      throw new BadRequestException('Selected user is not a student');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        user_id: studentId,
        course: {
          modules: {
            some: {
              classes: {
                some: {
                  id: classId,
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        'Student is not enrolled in this class course',
      );
    }

    const normalizedStatus = (body?.status || 'PRESENT').toUpperCase();
    const allowedStatuses = Object.values(AttendanceStatus);
    if (!allowedStatuses.includes(normalizedStatus as AttendanceStatus)) {
      throw new BadRequestException(
        `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
      );
    }

    let attendedAt: Date | null = null;
    if (body?.attendedAt) {
      const parsedDate = new Date(body.attendedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestException('Invalid attendedAt date');
      }
      attendedAt = parsedDate;
    } else if (normalizedStatus === AttendanceStatus.PRESENT) {
      attendedAt = new Date();
    }

    const existingAttendance = await this.prisma.attendance.findFirst({
      where: {
        class_id: classId,
        student_id: studentId,
      },
    });

    if (existingAttendance) {
      if (existingAttendance.status === normalizedStatus) {
        return {
          success: true,
          message: `Attendance already marked as ${normalizedStatus}`,
          data: existingAttendance,
        };
      }

      const updated = await this.prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: normalizedStatus as AttendanceStatus,
          attended_at:
            normalizedStatus === AttendanceStatus.PRESENT ? attendedAt : null,
          attendance_by: 'MANUAL',
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'Attendance updated manually',
        data: updated,
      };
    }

    const created = await this.prisma.attendance.create({
      data: {
        class_id: classId,
        student_id: studentId,
        status: normalizedStatus as AttendanceStatus,
        attended_at:
          normalizedStatus === AttendanceStatus.PRESENT ? attendedAt : null,
        attendance_by: 'MANUAL',
      },
    });

    return {
      success: true,
      message: 'Attendance marked manually',
      data: created,
    };
  }
}
