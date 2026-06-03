import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  AttendanceStatus,
  CourseStatus,
  EnrollmentStatus,
} from '@prisma/client';
import { Role } from 'src/common/guard/role/role.enum';
import { NajimStorage } from 'src/common/lib/Disk';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(user_id: string) {
    if (!user_id) throw new UnauthorizedException('Please login first');

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: { type: true },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const userType = user.type?.toLowerCase();

    const isFinance = userType === Role.FINANCE;
    const isTeacher = userType === Role.TEACHER;
    const isAdmin = userType === Role.ADMIN || userType === Role.SU_ADMIN;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    if (isTeacher && !isAdmin && !isFinance) {
      // ----------------------------------------------------
      // TEACHER OVERVIEW
      // ----------------------------------------------------
      const [
        myTotalStudents,
        myActiveCourses,
        totalAssignments,
        totalClasses,
        upComingClasses,
        attendance,
      ] = await Promise.all([
        this.prisma.user.count({
          where: {
            type: Role.STUDENT,
            enrollments: { some: { course: { instructor_id: user_id } } },
          },
        }),
        this.prisma.course.count({
          where: { instructor_id: user_id, status: CourseStatus.ACTIVE },
        }),
        this.prisma.assignment.count({
          where: { class: { module: { course: { instructor_id: user_id } } } },
        }),
        this.prisma.moduleClass.count({
          where: { module: { course: { instructor_id: user_id } } },
        }),
        this.prisma.moduleClass.findMany({
          where: {
            class_at: { gte: new Date() },
            module: { course: { instructor_id: user_id } },
          },
          take: 4,
          orderBy: { class_at: 'asc' },
          include: {
            module: {
              include: {
                course: {
                  include: { instructor: { select: { id: true, name: true } } },
                },
              },
            },
          },
        }),
        this.getRecentAttendance(user_id),
      ]);

      return {
        success: true,
        data: {
          role: 'teacher',
          my_total_students: myTotalStudents,
          my_active_courses: myActiveCourses,
          total_assignments: totalAssignments,
          total_classes: totalClasses,
          attendance,
          up_coming_classes: upComingClasses.map((cls) => ({
            id: cls.id,
            class_title: cls.class_title,
            class_name: cls.class_name,
            duration: cls.duration,
            class_at: cls.class_at,
            module_name: cls.module?.module_name,
            module_title: cls.module?.module_title,
            course_id: cls.module?.course?.id,
            course_title: cls.module?.course?.title,
            instructor_id: cls.module?.course?.instructor?.id,
            instructor_name: cls.module?.course?.instructor?.name,
          })),
        },
      };
    } else {
      // ----------------------------------------------------
      // ADMIN & FINANCE OVERVIEW
      // ----------------------------------------------------
      const promises: Promise<any>[] = [
        this.prisma.user.count({ where: { type: Role.STUDENT } }),
        this.prisma.user.count({ where: { type: Role.TEACHER } }),
        this.prisma.course.count({ where: { status: CourseStatus.ACTIVE } }),
        this.prisma.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: {
            status: 'SUCCESS',
            paid_at: { gte: startOfMonth, lte: endOfMonth },
          },
        }),
        this.prisma.enrollment.findMany({
          select: {
            id: true,
            status: true,
            created_at: true,
            user: { select: { id: true, name: true, avatar: true } },
            course: { select: { id: true, title: true } },
          },
          take: 4,
          orderBy: { created_at: 'desc' },
        }),
        this.getRecentAttendance(),
      ];

      if (isFinance) {
        promises.push(
          this.prisma.paymentTransaction.findMany({
            include: {
              user: { select: { id: true, name: true, avatar: true } },
            },
            take: 4,
            orderBy: { paid_at: 'desc' },
          }),
        );
      } else {
        promises.push(
          this.prisma.moduleClass.findMany({
            where: { class_at: { gte: new Date() } },
            take: 4,
            orderBy: { class_at: 'asc' },
            include: {
              module: {
                include: {
                  course: {
                    include: {
                      instructor: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          }),
        );
      }

      const results = await Promise.all(promises);

      const monthlyRevenue = Number(results[3]._sum.amount) || 0;
      const recentEnrollments = results[4];
      const attendance = results[5];
      const dynamicData = results[6];

      return {
        success: true,
        data: {
          role: isFinance ? 'finance' : 'admin',
          total_students: results[0],
          total_teachers: results[1],
          ongoing_courses: results[2],
          monthly_revenue: monthlyRevenue,
          attendance,
          recent_enrollments: recentEnrollments.map((enrollment: any) => ({
            id: enrollment.id,
            status: enrollment.status,
            user_id: enrollment.user?.id,
            user_name: enrollment.user?.name,
            user_avatar: enrollment.user?.avatar
              ? NajimStorage.url(enrollment.user.avatar)
              : null,
            course_id: enrollment.course?.id,
            course_title: enrollment.course?.title,
            created_at: enrollment.created_at,
          })),
          ...(isFinance
            ? {
                recent_transactions: dynamicData.map((trans: any) => ({
                  id: trans.id,
                  user_id: trans.user?.id,
                  user_name: trans.user?.name,
                  user_avatar: trans.user?.avatar
                    ? NajimStorage.url(trans.user.avatar)
                    : null,
                  amount: Number(trans.amount),
                  status: trans.status,
                  paid_at: trans.paid_at || trans.created_at,
                })),
              }
            : {
                upcoming_classes: dynamicData.map((cls: any) => ({
                  id: cls.id,
                  class_title: cls.class_title,
                  class_name: cls.class_name,
                  duration: cls.duration,
                  class_at: cls.class_at,
                  module_name: cls.module?.module_name,
                  module_title: cls.module?.module_title,
                  course_id: cls.module?.course?.id,
                  course_title: cls.module?.course?.title,
                  instructor_id: cls.module?.course?.instructor?.id,
                  instructor_name: cls.module?.course?.instructor?.name,
                })),
              }),
        },
      };
    }
  }

  private async getRecentAttendance(instructorId?: string) {
    const recentClasses = await this.prisma.moduleClass.findMany({
      where: {
        class_at: { lte: new Date() },
        ...(instructorId
          ? { module: { course: { instructor_id: instructorId } } }
          : {}),
      },
      take: 7,
      orderBy: { class_at: 'desc' },
      select: {
        id: true,
        class_name: true,
        class_title: true,
        class_at: true,
        attendances: {
          where: {
            status: {
              in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE],
            },
          },
          select: { id: true },
        },
        module: {
          select: {
            module_name: true,
            module_title: true,
            course: {
              select: {
                id: true,
                title: true,
                enrollments: {
                  where: { status: EnrollmentStatus.ACTIVE },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    const attendanceData = recentClasses.map((cls) => {
      const totalEnrolledStudents = cls.module.course.enrollments.length;
      const attendedStudents = cls.attendances.length;
      const attendancePercentage = totalEnrolledStudents
        ? Number(((attendedStudents / totalEnrolledStudents) * 100).toFixed(2))
        : 0;

      return {
        id: cls.id,
        module_name: cls.module.module_name,
        module_title: cls.module.module_title,
        class_name: cls.class_name,
        class_title: cls.class_title,
        class_at: cls.class_at,
        course_id: cls.module.course.id,
        course_title: cls.module.course.title,
        total_enrolled_students: totalEnrolledStudents,
        attendance_percentage: attendancePercentage,
      };
    });

    return attendanceData.slice(0, 6).map((item, index) => {
      const previousClass = attendanceData[index + 1];
      const previousPercentage = previousClass?.attendance_percentage;
      const attendanceStatus =
        previousPercentage === undefined
          ? 'same'
          : item.attendance_percentage > previousPercentage
            ? 'increment'
            : item.attendance_percentage < previousPercentage
              ? 'decrement'
              : 'same';

      return {
        ...item,
        previous_attendance_percentage: previousPercentage ?? null,
        attendance_status: attendanceStatus,
      };
    });
  }
}
