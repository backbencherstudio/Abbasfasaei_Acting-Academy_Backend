import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class AttendanceService {

    constructor( private prisma: PrismaService ) {}

  async qrscanner(token: string, userId: string) {
    try {
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
        throw new Error('User not found');
      }

      // Check if user has student role
      const isStudent = user.role_users.some(
        (roleUser) =>
          roleUser.role.name === 'STUDENT' ||
          roleUser.role.name === 'student' ||
          roleUser.role.name?.toUpperCase() === 'STUDENT',
      );

      if (!isStudent) {
        throw new Error('Only students can mark attendance via QR code');
      }

      // THEN: Verify QR session is valid and active (THIS IS WHERE TOKEN IS USED)
      const qrSession = await this.prisma.qRAttendanceSession.findFirst({
        where: {
          token,
          expires_at: { gt: now },
          is_active: true,
        },
        include: {
          class: true,
        },
      });

      if (!qrSession) {
        throw new Error('QR code is invalid or expired');
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
        throw new Error('You are not enrolled in this course');
      }

      // Check if student already marked attendance for this class today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingAttendance = await this.prisma.attendance.findFirst({
        where: {
          class_id: qrSession.class_id,
          student_id: userId,
          created_at: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (existingAttendance) {
        // Update existing attendance if already marked
        const updatedAttendance = await this.prisma.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            status: 'PRESENT',
            attended_at: now,
            attendance_by: 'QR',
            updated_at: now,
          },
        });

        return updatedAttendance;
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

      return attendance;
    } catch (error) {
      throw new Error(`Error marking attendance: ${error.message}`);
    }
  }
}
