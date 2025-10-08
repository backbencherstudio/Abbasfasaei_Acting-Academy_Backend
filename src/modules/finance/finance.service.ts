import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FinanceService {
  private logger = new Logger(FinanceService.name);
  constructor(private prisma: PrismaService) {}

  async getDashboardData(userId: string) {
    try {
      const userRole = await this.getUserRole(userId);

      if (
        userRole === 'finance' ||
        userRole === 'Finance' ||
        userRole === 'FINANCE'
      ) {
        return this.getFinanceDashboard();
      } else {
        return { message: 'Restricted', role: userRole };
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

  // Finacne DASHBOARD FUNCTIONS
  private async getFinanceDashboard() {
    try {
      const [
        totalStudents,
        totalOngoingCourses,
        monthlyRevenue,
        totalTeachers,
        recentEnrollments,
        getRecentTransactions,
        attendanceTracking,
      ] = await Promise.all([
        this.getTotalStudents(),
        this.getTotalOngoingCourses(),
        this.getMonthlyRevenue(),
        this.getTotalTeachers(),
        this.getRecentEnrollments(4),
        this.getRecentTransactions(),
        this.getAttendanceTracking(),
      ]);

      return {
        role: 'admin',
        totalStudents,
        totalOngoingCourses,
        monthlyRevenue,
        totalTeachers,
        recentEnrollments,
        getRecentTransactions,
        attendanceTracking,
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
      return await this.prisma.enrollment.findMany({
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
    } catch (error) {
      this.logger.error(`Error getting recent enrollments: ${error.message}`);
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
      this.logger.error(`Error getting attendance tracking: ${error.message}`);
      return [];
    }    
  }

  private async getRecentTransactions(limit: number = 6) {
    try {
        const recentTransactions = await this.prisma.paymentHistory.findMany({
            take: limit,
        });
        return recentTransactions;
    } catch (error) {
        this.logger.error(`Error getting recent transactions: ${error.message}`);
        return [];
    }
  }
}
