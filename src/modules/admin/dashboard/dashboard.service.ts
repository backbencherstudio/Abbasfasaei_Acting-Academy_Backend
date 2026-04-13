import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  async getDashboardData(userId: string) {
    try {
      const userRole = await this.getUserRole(userId);

      if (
        userRole === 'admin' ||
        userRole === 'Admin' ||
        userRole === 'ADMIN' ||
        userRole === 'su_admin'
      ) {
        return this.getAdminDashboard();
      } else if (
        userRole === 'teacher' ||
        userRole === 'Teacher' ||
        userRole === 'TEACHER'
      ) {
        return this.getTeacherDashboard(userId);
      } else if (
        userRole === 'finance' ||
        userRole === 'Finance' ||
        userRole === 'FINANCE'
      ) {
        return this.getFinanceDashboard();
      } else {
        return { message: 'Student dashboard data', role: userRole };
      }
    } catch (error) {
      this.logger.error(
        `Error getting dashboard data for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  // Role detection
  async getUserRole(userId: string) {
    try {
      const roleUser = await this.prisma.roleUser.findFirst({
        where: { user_id: userId },
        include: { role: true },
      });

      return roleUser?.role?.name;
    } catch (error) {
      this.logger.error(
        `Error getting user role for ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  // Date range helpers
  private getCurrentMonthDateRange() {
    try {
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
    } catch (error) {
      this.logger.error(
        `Error getting current month date range: ${error.message}`,
      );
      throw error;
    }
  }

  private getPreviousMonthDateRange() {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonthEnd = new Date(currentMonthStart.getTime() - 1);
      const previousMonthStart = new Date(
        previousMonthEnd.getFullYear(),
        previousMonthEnd.getMonth(),
        1,
      );
      return { start: previousMonthStart, end: previousMonthEnd };
    } catch (error) {
      this.logger.error(
        `Error getting previous month date range: ${error.message}`,
      );
      throw error;
    }
  }

  private calculatePercentageChange(current: number, previous: number): number {
    try {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    } catch (error) {
      this.logger.error(
        `Error calculating percentage change: ${error.message}`,
      );
      return 0;
    }
  }

  // ADMIN DASHBOARD FUNCTIONS
  private async getAdminDashboard() {
    try {
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
    } catch (error) {
      this.logger.error(`Error getting admin dashboard: ${error.message}`);
      throw error;
    }
  }

  // TEACHER DASHBOARD FUNCTIONS
  private async getTeacherDashboard(teacherId: string) {
    try {
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
    } catch (error) {
      this.logger.error(
        `Error getting teacher dashboard for ${teacherId}: ${error.message}`,
      );
      throw error;
    }
  }

  // FINANCE DASHBOARD FUNCTIONS
  private async getFinanceDashboard() {
    try {
      const [
        totalStudents,
        totalOngoingCourses,
        monthlyRevenue,
        totalTeachers,
        recentEnrollments,
        getRecentTransactions,
      ] = await Promise.all([
        this.getTotalStudents(),
        this.getTotalOngoingCourses(),
        this.getMonthlyRevenue(),
        this.getTotalTeachers(),
        this.getRecentEnrollments(4),
        this.getRecentTransactions(),
      ]);

      return {
        role: 'admin',
        totalStudents,
        totalOngoingCourses,
        monthlyRevenue,
        totalTeachers,
        recentEnrollments,
        getRecentTransactions,
      };
    } catch (error) {
      this.logger.error(`Error getting admin dashboard: ${error.message}`);
      throw error;
    }
  }

  // INDEPENDENT FUNCTIONS FOR ADMIN
  private async getTotalStudents() {
    try {
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
    } catch (error) {
      this.logger.error(`Error getting total students: ${error.message}`);
      return { current: 0, previous: 0, percentageChange: 0 };
    }
  }

  private async getTotalOngoingCourses() {
    try {
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
    } catch (error) {
      this.logger.error(
        `Error getting total ongoing courses: ${error.message}`,
      );
      return { current: 0, previous: 0, percentageChange: 0 };
    }
  }

  private async getMonthlyRevenue() {
    try {
      const currentMonth = this.getCurrentMonthDateRange();
      const previousMonth = this.getPreviousMonthDateRange();

      const [currentRevenue, previousRevenue] = await Promise.all([
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            status: 'SUCCESS',
            payment_date: {
              gte: currentMonth.start,
              lte: currentMonth.end,
            },
          },
        }),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            status: 'SUCCESS',
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
    } catch (error) {
      this.logger.error(`Error getting monthly revenue: ${error.message}`);
      return { current: 0, previous: 0, percentageChange: 0 };
    }
  }

  private async getTotalTeachers() {
    try {
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
    } catch (error) {
      this.logger.error(`Error getting total teachers: ${error.message}`);
      return { current: 0, previous: 0, percentageChange: 0 };
    }
  }

  private async getRecentEnrollments(limit: number = 4) {
    try {
      const enrollments = await this.prisma.enrollment.findMany({
        include: {
          course: true,
          user: true,
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      });
      return enrollments.map((enroll) => ({
        id: enroll.id,
        userName: enroll?.user?.name,
        full_name: enroll.user.first_name + ' ' + enroll.user.last_name,
        avatar: enroll?.user?.avatar
          ? enroll.user.avatar.startsWith('http')
            ? enroll.user.avatar
            : SazedStorage.url(
                `${appConfig().storageUrl.avatar.replace(/\/+$/, '')}/${String(enroll.user.avatar).replace(/^\/+/, '')}`,
              )
          : null,
        courseName: enroll.course.title,
        status: enroll.step === 'COMPLETED' ? 'Enrolled' : 'Pending',
        updatedAt: enroll.updated_at,
      }));
    } catch (error) {
      this.logger.error(`Error getting recent enrollments: ${error.message}`);
      return [];
    }
  }

  private async getUpcomingClasses(limit: number = 4) {
    try {
      return await this.prisma.moduleClass.findMany({
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
    } catch (error) {
      this.logger.error(`Error getting upcoming classes: ${error.message}`);
      return [];
    }
  }

  private async getAttendanceTracking() {
    try {
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
              course: {
                select: {
                  title: true,
                  enrollments: {
                    where: {
                      status: 'ACTIVE',
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { start_date: 'desc' },
        take: 6,
      });

      return recentClasses.map((cls) => ({
        classTitle: cls.class_title,
        course: cls.module.course.title,
        totalStudents: cls.attendances.length,
        totalEnrollments: cls.module.course.enrollments.length,
        date: cls.start_date,
      }));
    } catch (error) {
      this.logger.error(`Error getting attendance tracking: ${error.message}`);
      return [];
    }
  }

  // INDEPENDENT FUNCTIONS FOR TEACHER
  private async getTeacherTotalStudents(teacherId: string) {
    try {
      return await this.prisma.enrollment.count({
        where: {
          course: { instructorId: teacherId },
          status: 'ACTIVE',
        },
      });
    } catch (error) {
      this.logger.error(
        `Error getting teacher total students for ${teacherId}: ${error.message}`,
      );
      return 0;
    }
  }

  private async getTeacherActiveCourses(teacherId: string) {
    try {
      return await this.prisma.course.count({
        where: {
          instructorId: teacherId,
          status: 'ACTIVE',
        },
      });
    } catch (error) {
      this.logger.error(
        `Error getting teacher active courses for ${teacherId}: ${error.message}`,
      );
      return 0;
    }
  }

  private async getTeacherTotalAssignments(teacherId: string) {
    try {
      return await this.prisma.assignment.count({
        where: {
          teacherId: teacherId,
          due_date: { gte: new Date() },
        },
      });
    } catch (error) {
      this.logger.error(
        `Error getting teacher total assignments for ${teacherId}: ${error.message}`,
      );
      return 0;
    }
  }

  private async getTeacherUpcomingClasses(
    teacherId: string,
    limit: number = 4,
  ) {
    try {
      return await this.prisma.moduleClass.findMany({
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
    } catch (error) {
      this.logger.error(
        `Error getting teacher upcoming classes for ${teacherId}: ${error.message}`,
      );
      return [];
    }
  }

  private async getTeacherAttendanceTracking(teacherId: string) {
    try {
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
    } catch (error) {
      this.logger.error(
        `Error getting teacher attendance tracking for ${teacherId}: ${error.message}`,
      );
      return [];
    }
  }

  private async getRecentTransactions(limit: number = 6) {
    try {
      const recentTransactions = await this.prisma.transaction.findMany({
        include: {
          user: true,
        },
        take: limit,
        orderBy: { payment_date: 'desc' },
      });
      return recentTransactions.map((trans) => ({
        id: trans.id,
        userId: trans.user.id || trans.user_id,
        userName: trans.user.name || trans.user.username || 'N/A',
        amount: trans.amount,
        paymentDate: trans.payment_date || trans.created_at,
        paymentStatus: trans.status,
      }));
    } catch (error) {
      this.logger.error(`Error getting recent transactions: ${error.message}`);
      return [];
    }
  }
}
