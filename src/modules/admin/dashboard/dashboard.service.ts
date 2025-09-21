// src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private getPreviousMonthDateRange(): { start: Date; end: Date } {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthEnd = new Date(currentMonthStart.getTime() - 1);
    const previousMonthStart = new Date(
      previousMonthEnd.getFullYear(),
      previousMonthEnd.getMonth(),
      1,
    );

    return {
      start: previousMonthStart,
      end: previousMonthEnd,
    };
  }

  private getCurrentMonthDateRange(): { start: Date; end: Date } {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    return {
      start: currentMonthStart,
      end: currentMonthEnd,
    };
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  async getAdminDashboard() {
    const currentMonth = this.getCurrentMonthDateRange();
    const previousMonth = this.getPreviousMonthDateRange();

    // Total Students (users with type 'student')
    const currentStudents = await this.prisma.user.count({
      where: {
        type: 'student',
        created_at: { lte: currentMonth.end },
      },
    });

    const previousStudents = await this.prisma.user.count({
      where: {
        type: 'student',
        created_at: { lte: previousMonth.end },
      },
    });

    // Total Ongoing Courses (active courses with upcoming classes)
    const currentOngoingCourses = await this.prisma.course.count({
      where: {
        status: 'ACTIVE',
        start_date: { lte: currentMonth.end },
        modules: {
          some: {
            classes: {
              some: {
                start_date: { gte: currentMonth.start }
              }
            }
          }
        }
      },
    });

    const previousOngoingCourses = await this.prisma.course.count({
      where: {
        status: 'ACTIVE',
        start_date: { lte: previousMonth.end },
        modules: {
          some: {
            classes: {
              some: {
                start_date: { gte: previousMonth.start }
              }
            }
          }
        }
      },
    });

    // Monthly Revenue
    const currentRevenue = await this.prisma.userPayment.aggregate({
      _sum: { amount: true },
      where: {
        payment_status: 'PAID',
        payment_date: {
          gte: currentMonth.start,
          lte: currentMonth.end,
        },
      },
    });

    const previousRevenue = await this.prisma.userPayment.aggregate({
      _sum: { amount: true },
      where: {
        payment_status: 'PAID',
        payment_date: {
          gte: previousMonth.start,
          lte: previousMonth.end,
        },
      },
    });

    // Total Teachers
    const currentTeachers = await this.prisma.user.count({
      where: {
        type: 'teacher',
        created_at: { lte: currentMonth.end },
      },
    });

    const previousTeachers = await this.prisma.user.count({
      where: {
        type: 'teacher',
        created_at: { lte: previousMonth.end },
      },
    });

    // Recent Enrollments (last 10)
    const recentEnrollments = await this.prisma.enrollment.findMany({
      where: {
        status: { not: 'PENDING' },
      },
      include: {
        course: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    // Upcoming Classes (next 7 days)
    const upcomingClasses = await this.prisma.moduleClass.findMany({
      where: {
        start_date: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        module: {
          include: {
            course: {
              include: {
                instructor: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { start_date: 'asc' },
      take: 10,
    });

    // Attendance Tracking
    const totalClasses = await this.prisma.moduleClass.count({
      where: {
        start_date: { lte: new Date() },
      },
    });

    const completedClasses = await this.prisma.moduleClass.count({
      where: {
        start_date: { lte: new Date() },
        attendances: {
          some: {},
        },
      },
    });

    const totalStudents = currentStudents;

    // Calculate average attendance manually since Prisma doesn't support _avg on enum fields
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        class: {
          start_date: { lte: new Date() },
        },
      },
      select: {
        status: true,
      },
    });

    const presentCount = attendanceRecords.filter(
      (record) => record.status === 'PRESENT',
    ).length;
    const averageAttendance =
      attendanceRecords.length > 0
        ? (presentCount / attendanceRecords.length) * 100
        : 0;

    return {
      totalStudents: {
        current: currentStudents,
        previous: previousStudents,
        percentageChange: this.calculatePercentageChange(
          currentStudents,
          previousStudents,
        ),
      },
      totalOngoingCourses: {
        current: currentOngoingCourses,
        previous: previousOngoingCourses,
        percentageChange: this.calculatePercentageChange(
          currentOngoingCourses,
          previousOngoingCourses,
        ),
      },
      monthlyRevenue: {
        current: Number(currentRevenue._sum.amount) || 0,
        previous: Number(previousRevenue._sum.amount) || 0,
        percentageChange: this.calculatePercentageChange(
          Number(currentRevenue._sum.amount) || 0,
          Number(previousRevenue._sum.amount) || 0,
        ),
      },
      totalTeachers: {
        current: currentTeachers,
        previous: previousTeachers,
        percentageChange: this.calculatePercentageChange(
          currentTeachers,
          previousTeachers,
        ),
      },
      recentEnrollments,
      upcomingClasses,
      attendanceTracking: {
        totalClasses,
        completedClasses,
        totalStudents,
        averageAttendance,
      },
    };
  }

  async getTeacherDashboard(teacherId: string) {
    // Total Students for this teacher
    const totalStudents = await this.prisma.enrollment.count({
      where: {
        course: {
          instructorId: teacherId,
        },
        status: 'ACTIVE',
      },
    });

    // Active Courses
    const activeCourses = await this.prisma.course.findMany({
      where: {
        instructorId: teacherId,
        status: 'ACTIVE',
      },
      include: {
        enrollments: {
          where: {
            status: 'ACTIVE',
          },
          select: {
            id: true,
          },
        },
        modules: {
          include: {
            classes: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    // Active Assignments
    const activeAssignments = await this.prisma.assignment.findMany({
      where: {
        teacherId: teacherId,
        due_date: { gte: new Date() },
      },
      include: {
        moduleClass: {
          include: {
            module: {
              include: {
                course: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { due_date: 'asc' },
    });

    // Completion Rate (based on assignments)
    const totalAssignments = await this.prisma.assignment.count({
      where: {
        teacherId: teacherId,
      },
    });

    const completedAssignments = await this.prisma.assignmentSubmission.count({
      where: {
        assignment: {
          teacherId: teacherId,
        },
      },
    });

    const completionRate =
      totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0;

    // Upcoming Classes for this teacher (next 7 days)
    const upcomingClasses = await this.prisma.moduleClass.findMany({
      where: {
        module: {
          course: {
            instructorId: teacherId,
          },
        },
        start_date: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        module: {
          include: {
            course: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: { start_date: 'asc' },
      take: 10,
    });

    // Attendance Tracking for teacher's courses
    const teacherClasses = await this.prisma.moduleClass.findMany({
      where: {
        module: {
          course: {
            instructorId: teacherId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    const classIds = teacherClasses.map((cls) => cls.id);

    const totalClasses = await this.prisma.moduleClass.count({
      where: {
        id: { in: classIds },
        start_date: { lte: new Date() },
      },
    });

    const completedClasses = await this.prisma.moduleClass.count({
      where: {
        id: { in: classIds },
        start_date: { lte: new Date() },
        attendances: {
          some: {},
        },
      },
    });

    // Calculate average attendance manually
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        class_id: { in: classIds },
        class: {
          start_date: { lte: new Date() },
        },
      },
      select: {
        status: true,
      },
    });

    const presentCount = attendanceRecords.filter(
      (record) => record.status === 'PRESENT',
    ).length;
    const averageAttendance =
      attendanceRecords.length > 0
        ? (presentCount / attendanceRecords.length) * 100
        : 0;

    return {
      totalStudents,
      activeCourses,
      activeAssignments,
      completionRate,
      upcomingClasses,
      attendanceTracking: {
        totalClasses,
        completedClasses,
        totalStudents,
        averageAttendance,
      },
    };
  }
}