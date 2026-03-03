import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface RevenueData {
  current: number;
  previous: number;
  percentageChange: number;
}

interface RecentTransaction {
  userId: string;
  username: string;
  transactionId: string;
  amount: number;
  date: Date;
  paymentType: string;
  paymentPlan: string;
  invoiceFile?: string;
}

export interface FinanceDashboardData {
  totalRevenueThisYear: RevenueData;
  courseRevenue: RevenueData;
  eventsRevenue: RevenueData;
  currentMonthRevenue: RevenueData;
  recentTransactions: RecentTransaction[];
}

@Injectable()
export class FinanceAndPaymentsService {
  constructor(private prisma: PrismaService) {}

  async getFinanceDashboardData(): Promise<FinanceDashboardData> {
    try {
      const [
        totalRevenueThisYear,
        courseRevenue,
        eventsRevenue,
        currentMonthRevenue,
        recentTransactions,
      ] = await Promise.all([
        this.getTotalRevenueThisYear(),
        this.getCourseRevenue(),
        this.getEventsRevenue(),
        this.getCurrentMonthRevenue(),
        this.getRecentTransactions(),
      ]);

      return {
        totalRevenueThisYear,
        courseRevenue,
        eventsRevenue,
        currentMonthRevenue,
        recentTransactions,
      };
    } catch (error) {
      console.error('Error in getFinanceDashboardData:', error);
      throw new Error('Failed to fetch finance dashboard data');
    }
  }

  private async getTotalRevenueThisYear(): Promise<RevenueData> {
    try {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Current year revenue (from January 1st of current year to now)
      const currentYearStart = new Date(currentYear, 0, 1); // January 1st
      const currentYearEnd = new Date();

      // Last year revenue (entire last year)
      const lastYearStart = new Date(lastYear, 0, 1);
      const lastYearEnd = new Date(lastYear, 11, 31, 23, 59, 59);

      const [currentYearRevenue, lastYearRevenue] = await Promise.all([
        // All payments from current year
        this.prisma.transaction.aggregate({
          where: {
            status: 'SUCCESS',
            payment_date: {
              gte: currentYearStart,
              lte: currentYearEnd,
            },
          },
          _sum: { amount: true },
        }),
        // All payments from last year
        this.prisma.transaction.aggregate({
          where: {
            status: 'SUCCESS',
            payment_date: {
              gte: lastYearStart,
              lte: lastYearEnd,
            },
          },
          _sum: { amount: true },
        }),
      ]);

      const currentTotal = currentYearRevenue._sum.amount?.toNumber() || 0;
      const previousTotal = lastYearRevenue._sum.amount?.toNumber() || 0;

      const percentageChange =
        previousTotal > 0
          ? ((currentTotal - previousTotal) / previousTotal) * 100
          : currentTotal > 0
            ? 100
            : 0;

      return {
        current: currentTotal,
        previous: previousTotal,
        percentageChange: Number(percentageChange.toFixed(2)),
      };
    } catch (error) {
      console.error('Error in getTotalRevenueThisYear:', error);
      return { current: 0, previous: 0, percentageChange: 0 };
    }
  }

  private async getCourseRevenue(): Promise<RevenueData> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
      );

      const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: {
            status: 'SUCCESS',
            order: { items: { some: { item_type: 'COURSE_ENROLLMENT' } } },
            payment_date: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            status: 'SUCCESS',
            order: { items: { some: { item_type: 'COURSE_ENROLLMENT' } } },
            payment_date: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
          _sum: { amount: true },
        }),
      ]);

      const current = currentMonthRevenue._sum.amount?.toNumber() || 0;
      const previous = lastMonthRevenue._sum.amount?.toNumber() || 0;
      const percentageChange =
        previous > 0
          ? ((current - previous) / previous) * 100
          : current > 0
            ? 100
            : 0;

      return {
        current,
        previous,
        percentageChange: Number(percentageChange.toFixed(2)),
      };
    } catch (error) {
      console.error('Error in getCourseRevenue:', error);
      return { current: 0, previous: 0, percentageChange: 0 };
    }
  }

  private async getEventsRevenue(): Promise<RevenueData> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
      );

      const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: {
            status: 'SUCCESS',
            order: { items: { some: { item_type: 'EVENT_TICKET' } } },
            payment_date: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            status: 'SUCCESS',
            order: { items: { some: { item_type: 'EVENT_TICKET' } } },
            payment_date: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
          _sum: { amount: true },
        }),
      ]);

      const current = currentMonthRevenue._sum.amount?.toNumber() || 0;
      const previous = lastMonthRevenue._sum.amount?.toNumber() || 0;
      const percentageChange =
        previous > 0
          ? ((current - previous) / previous) * 100
          : current > 0
            ? 100
            : 0;

      return {
        current,
        previous,
        percentageChange: Number(percentageChange.toFixed(2)),
      };
    } catch (error) {
      console.error('Error in getEventsRevenue:', error);
      return { current: 0, previous: 0, percentageChange: 0 };
    }
  }

  private async getCurrentMonthRevenue(): Promise<RevenueData> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
      );

      const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: {
            status: 'SUCCESS',
            payment_date: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            status: 'SUCCESS',
            payment_date: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
          _sum: { amount: true },
        }),
      ]);

      const current = currentMonthRevenue._sum.amount?.toNumber() || 0;
      const previous = lastMonthRevenue._sum.amount?.toNumber() || 0;

      const percentageChange =
        previous > 0
          ? ((current - previous) / previous) * 100
          : current > 0
            ? 100
            : 0;

      return {
        current,
        previous,
        percentageChange: Number(percentageChange.toFixed(2)),
      };
    } catch (error) {
      console.error('Error in getCurrentMonthRevenue:', error);
      return { current: 0, previous: 0, percentageChange: 0 };
    }
  }

  private async getRecentTransactions(): Promise<RecentTransaction[]> {
    try {
      // Get recent transactions (both course and events)
      const transactions = await this.prisma.transaction.findMany({
        where: {
          status: 'SUCCESS',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
          order: {
            include: {
              items: {
                include: {
                  course: { select: { title: true } },
                  event: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: {
          payment_date: 'desc',
        },
        take: 10,
      });

      // Format transactions
      const recentTransactions: RecentTransaction[] = transactions.map(
        (transaction) => {
          const itemType = transaction.order?.items[0]?.item_type;
          return {
            userId: transaction.user.id,
            username:
              transaction.user.username || transaction.user.name || 'N/A',
            transactionId:
              transaction.transaction_ref || `TRX-${transaction.id}`,
            amount: transaction.amount?.toNumber() || 0,
            date: transaction.payment_date || transaction.created_at,
            paymentType:
              itemType === 'EVENT_TICKET'
                ? 'Event Booking'
                : 'Course Enrollment',
            paymentPlan: transaction.payment_method || 'One Time',
            invoiceFile: transaction.receipt_url || undefined,
          };
        },
      );

      return recentTransactions;
    } catch (error) {
      console.error('Error in getRecentTransactions:', error);
      return [];
    }
  }
}
