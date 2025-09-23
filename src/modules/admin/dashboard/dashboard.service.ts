import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(userId: string) {
    const userRole = await this.getUserRole(userId);

    if (userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN') {
      return this.getAdminDashboard();
    } else if (userRole === 'teacher' || userRole === 'Teacher' || userRole === 'TEACHER') {
      return this.getTeacherDashboard(userId);
    } else {
      return { message: 'Student dashboard data', role: userRole };
    }
  }

  // Role detection
  async getUserRole(userId: string) {
    const roleUser = await this.prisma.roleUser.findFirst({
      where: { user_id: userId },
      include: { role: true },
    });

    return roleUser?.role?.name;
  }

  // Date range helpers
  private getCurrentMonthDateRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { start, end };
  }

  private getPreviousMonthDateRange() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthEnd = new Date(currentMonthStart.getTime() - 1);
    const previousMonthStart = new Date(
      previousMonthEnd.getFullYear(),
      previousMonthEnd.getMonth(),
      1,
    );
    return { start: previousMonthStart, end: previousMonthEnd };
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  // ADMIN DASHBOARD FUNCTIONS
  private async getAdminDashboard() {
    const [
      totalStudents,
      totalOngoingCourses,
      monthlyRevenue,
      totalTeachers,
      recentEnrollments,
      upcomingClasses,
      attendanceTracking,
    ] = await Promise.all([
      this.getTotalStudents(),
      this.getTotalOngoingCourses(),
      this.getMonthlyRevenue(),
      this.getTotalTeachers(),
      this.getRecentEnrollments(4),
      this.getUpcomingClasses(4),
      this.getAttendanceTracking(),
    ]);

    return {
      role: 'admin',
      totalStudents,
      totalOngoingCourses,
      monthlyRevenue,
      totalTeachers,
      recentEnrollments,
      upcomingClasses,
      attendanceTracking,
    };
  }

  // TEACHER DASHBOARD FUNCTIONS
  private async getTeacherDashboard(teacherId: string) {
    const [
      totalStudents,
      activeCourses,
      totalAssignments,
      upcomingClasses,
      attendanceTracking,
    ] = await Promise.all([
      this.getTeacherTotalStudents(teacherId),
      this.getTeacherActiveCourses(teacherId),
      this.getTeacherTotalAssignments(teacherId),
      this.getTeacherUpcomingClasses(teacherId, 4),
      this.getTeacherAttendanceTracking(teacherId),
    ]);

    return {
      role: 'teacher',
      totalStudents,
      activeCourses,
      totalAssignments,
      upcomingClasses,
      attendanceTracking,
    };
  }

  // INDEPENDENT FUNCTIONS FOR ADMIN
  private async getTotalStudents() {
    const currentMonth = this.getCurrentMonthDateRange();
    const previousMonth = this.getPreviousMonthDateRange();

    const [current, previous] = await Promise.all([
      this.prisma.user.count({
        where: {
          type: 'student',
          created_at: { lte: currentMonth.end },
        },
      }),
      this.prisma.user.count({
        where: {
          type: 'student',
          created_at: { lte: previousMonth.end },
        },
      }),
    ]);

    return {
      current,
      previous,
      percentageChange: this.calculatePercentageChange(current, previous),
    };
  }

  private async getTotalOngoingCourses() {
    const currentMonth = this.getCurrentMonthDateRange();
    const previousMonth = this.getPreviousMonthDateRange();

    const [current, previous] = await Promise.all([
      this.prisma.course.count({
        where: {
          status: 'ACTIVE',
          modules: {
            some: {
              classes: {
                some: {
                  start_date: {
                    lte: currentMonth.end,
                    gte: currentMonth.start,
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.course.count({
        where: {
          status: 'ACTIVE',
          modules: {
            some: {
              classes: {
                some: {
                  start_date: {
                    lte: previousMonth.end,
                    gte: previousMonth.start,
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      current,
      previous,
      percentageChange: this.calculatePercentageChange(current, previous),
    };
  }

  private async getMonthlyRevenue() {
    const currentMonth = this.getCurrentMonthDateRange();
    const previousMonth = this.getPreviousMonthDateRange();

    const [currentRevenue, previousRevenue] = await Promise.all([
      this.prisma.paymentHistory.aggregate({
        _sum: { amount: true },
        where: {
          payment_status: 'PAID',
          payment_date: {
            gte: currentMonth.start,
            lte: currentMonth.end,
          },
        },
      }),
      this.prisma.paymentHistory.aggregate({
        _sum: { amount: true },
        where: {
          payment_status: 'PAID',
          payment_date: {
            gte: previousMonth.start,
            lte: previousMonth.end,
          },
        },
      }),
    ]);

    const current = Number(currentRevenue._sum.amount) || 0;
    const previous = Number(previousRevenue._sum.amount) || 0;

    return {
      current,
      previous,
      percentageChange: this.calculatePercentageChange(current, previous),
    };
  }

  private async getTotalTeachers() {
    const currentMonth = this.getCurrentMonthDateRange();
    const previousMonth = this.getPreviousMonthDateRange();

    const [current, previous] = await Promise.all([
      this.prisma.user.count({
        where: {
          type: 'teacher',
          created_at: { lte: currentMonth.end },
        },
      }),
      this.prisma.user.count({
        where: {
          type: 'teacher',
          created_at: { lte: previousMonth.end },
        },
      }),
    ]);

    return {
      current,
      previous,
      percentageChange: this.calculatePercentageChange(current, previous),
    };
  }

  private async getRecentEnrollments(limit: number = 4) {
    return this.prisma.enrollment.findMany({
      where: {
        status: { not: 'PENDING' },
      },
      include: {
        course: { select: { title: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  private async getUpcomingClasses(limit: number = 4) {
    return this.prisma.moduleClass.findMany({
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
                instructor: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { start_date: 'asc' },
      take: limit,
    });
  }

  private async getAttendanceTracking() {
    const recentClasses = await this.prisma.moduleClass.findMany({
      where: {
        start_date: { lte: new Date() },
      },
      include: {
        attendances: {
          where: { status: 'PRESENT' },
        },
        module: {
          include: {
            course: { select: { title: true } },
          },
        },
      },
      orderBy: { start_date: 'desc' },
      take: 5,
    });

    return recentClasses.map((cls) => ({
      classTitle: cls.class_title,
      course: cls.module.course.title,
      totalStudents: cls.attendances.length,
      date: cls.start_date,
    }));
  }

  // INDEPENDENT FUNCTIONS FOR TEACHER
  private async getTeacherTotalStudents(teacherId: string) {
    return this.prisma.enrollment.count({
      where: {
        course: { instructorId: teacherId },
        status: 'ACTIVE',
      },
    });
  }

  private async getTeacherActiveCourses(teacherId: string) {
    return this.prisma.course.count({
      where: {
        instructorId: teacherId,
        status: 'ACTIVE',
      },
    });
  }

  private async getTeacherTotalAssignments(teacherId: string) {
    return this.prisma.assignment.count({
      where: {
        teacherId: teacherId,
        due_date: { gte: new Date() },
      },
    });
  }

  private async getTeacherUpcomingClasses(
    teacherId: string,
    limit: number = 4,
  ) {
    return this.prisma.moduleClass.findMany({
      where: {
        module: {
          course: { instructorId: teacherId },
        },
        start_date: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        module: {
          include: {
            course: { select: { title: true } },
          },
        },
      },
      orderBy: { start_date: 'asc' },
      take: limit,
    });
  }

  private async getTeacherAttendanceTracking(teacherId: string) {
    const recentClasses = await this.prisma.moduleClass.findMany({
      where: {
        module: {
          course: { instructorId: teacherId },
        },
        start_date: { lte: new Date() },
      },
      include: {
        attendances: {
          where: { status: 'PRESENT' },
        },
        module: {
          include: {
            course: { select: { title: true } },
          },
        },
      },
      orderBy: { start_date: 'desc' },
      take: 5,
    });

    return recentClasses.map((cls) => ({
      classTitle: cls.class_title,
      course: cls.module.course.title,
      totalStudents: cls.attendances.length,
      date: cls.start_date,
    }));
  }
}
