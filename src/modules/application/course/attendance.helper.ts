import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class AttendanceService {

    constructor( private prisma: PrismaService ) {}

  async qrscanner(token: string, userId: string) {
    try {
        const normalizedToken = (token || '').trim();
        if (!normalizedToken) {
          throw new BadRequestException('QR token is required');
        }

        if (!userId) {
          throw new BadRequestException('User ID is required');
        }

      const now = new Date();

      // FIRST: Check if the user is actually a student
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          role_users: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user has student role
      const isStudent = user.role_users.some(
        (roleUser) =>
          roleUser.role.name === 'STUDENT' ||
          roleUser.role.name === 'student' ||
          roleUser.role.name?.toUpperCase() === 'STUDENT',
      );

      if (!isStudent) {
        throw new ForbiddenException(
          'Only students can mark attendance via QR code',
        );
      }

      // THEN: Verify QR session is valid and active (THIS IS WHERE TOKEN IS USED)
      const qrSession = await this.prisma.qRAttendanceSession.findFirst({
        where: {
          token: normalizedToken,
          expires_at: { gt: now },
          is_active: true,
        },
        include: {
          class: true,
        },
      });

      if (!qrSession) {
        throw new BadRequestException('QR code is invalid or expired');
      }

      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          user_id: userId,
          course: {
            modules: {
              some: {
                classes: {
                  some: {
                    id: qrSession.class_id,
                  },
                },
              },
            },
          },
        },
      });

      if (!enrollment) {
        throw new ForbiddenException('You are not enrolled in this course');
      }

      const existingAttendance = await this.prisma.attendance.findFirst({
        where: {
          class_id: qrSession.class_id,
          student_id: userId,
        },
      });

      if (existingAttendance) {
        throw new ConflictException(
          'Attendance already marked for this class',
        );
      }

      // Create new attendance record
      const attendance = await this.prisma.attendance.create({
        data: {
          class_id: qrSession.class_id,
          student_id: userId,
          status: 'PRESENT',
          attended_at: now,
          attendance_by: 'QR',
        },
      });

      return {
        success: true,
        message: 'Attendance marked successfully',
        data: attendance,
      };
    } catch (error) {
      throw error;
    }
  }
}
