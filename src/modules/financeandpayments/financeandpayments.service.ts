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
        // Course payments from current year
        this.prisma.userPayment.aggregate({
          where: {
            payment_status: 'PAID',
            payment_date: {
              gte: currentYearStart,
              lte: currentYearEnd,
            },
          },
          _sum: {
            amount: true,
          },
        }),
        // Event payments from current year
        this.prisma.eventPayment.aggregate({
          where: {
            status: 'PAID',
            payment_date: {
              gte: currentYearStart,
              lte: currentYearEnd,
            },
          },
          _sum: {
            amount: true,
          },
        }),
        // Course payments from last year
        this.prisma.userPayment.aggregate({
          where: {
            payment_status: 'PAID',
            payment_date: {
              gte: lastYearStart,
              lte: lastYearEnd,
            },
          },
          _sum: {
            amount: true,
          },
        }),
        // Event payments from last year
        this.prisma.eventPayment.aggregate({
          where: {
            status: 'PAID',
            payment_date: {
              gte: lastYearStart,
              lte: lastYearEnd,
            },
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

      const currentTotal = 
        (currentYearRevenue._sum.amount?.toNumber() || 0) +
        (lastYearRevenue._sum.amount?.toNumber() || 0);
      
      const previousTotal = 
        (currentYearRevenue._sum.amount?.toNumber() || 0) +
        (lastYearRevenue._sum.amount?.toNumber() || 0);

      const percentageChange = previousTotal > 0 
        ? ((currentTotal - previousTotal) / previousTotal) * 100 
        : currentTotal > 0 ? 100 : 0;

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
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
        this.prisma.userPayment.aggregate({
          where: {
            payment_status: 'PAID',
            payment_date: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: {
            amount: true,
          },
        }),
        this.prisma.userPayment.aggregate({
          where: {
            payment_status: 'PAID',
            payment_date: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

      const current = currentMonthRevenue._sum.amount?.toNumber() || 0;
      const previous = lastMonthRevenue._sum.amount?.toNumber() || 0;
      const percentageChange = previous > 0 
        ? ((current - previous) / previous) * 100 
        : current > 0 ? 100 : 0;

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
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
        this.prisma.eventPayment.aggregate({
          where: {
            status: 'PAID',
            payment_date: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: {
            amount: true,
          },
        }),
        this.prisma.eventPayment.aggregate({
          where: {
            status: 'PAID',
            payment_date: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

      const current = currentMonthRevenue._sum.amount?.toNumber() || 0;
      const previous = lastMonthRevenue._sum.amount?.toNumber() || 0;
      const percentageChange = previous > 0 
        ? ((current - previous) / previous) * 100 
        : current > 0 ? 100 : 0;

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
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const [
        currentMonthCourseRevenue,
        currentMonthEventRevenue,
        lastMonthCourseRevenue,
        lastMonthEventRevenue,
      ] = await Promise.all([
        this.prisma.userPayment.aggregate({
          where: {
            payment_status: 'PAID',
            payment_date: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: {
            amount: true,
          },
        }),
        this.prisma.eventPayment.aggregate({
          where: {
            status: 'PAID',
            payment_date: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: {
            amount: true,
          },
        }),
        this.prisma.userPayment.aggregate({
          where: {
            payment_status: 'PAID',
            payment_date: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
          _sum: {
            amount: true,
          },
        }),
        this.prisma.eventPayment.aggregate({
          where: {
            status: 'PAID',
            payment_date: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

      const current = 
        (currentMonthCourseRevenue._sum.amount?.toNumber() || 0) +
        (currentMonthEventRevenue._sum.amount?.toNumber() || 0);
      
      const previous = 
        (lastMonthCourseRevenue._sum.amount?.toNumber() || 0) +
        (lastMonthEventRevenue._sum.amount?.toNumber() || 0);

      const percentageChange = previous > 0 
        ? ((current - previous) / previous) * 100 
        : current > 0 ? 100 : 0;

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
      // Get recent course payments
      const coursePayments = await this.prisma.userPayment.findMany({
        where: {
          payment_status: 'PAID',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
          enrollment: {
            include: {
              course: {
                select: {
                  title: true,
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

      // Get recent event payments
      const eventPayments = await this.prisma.eventPayment.findMany({
        where: {
          status: 'PAID',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
          event: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          payment_date: 'desc',
        },
        take: 10,
      });

      // Combine and format transactions
      const courseTransactions: RecentTransaction[] = coursePayments.map(payment => ({
        userId: payment.user.id,
        username: payment.user.username || payment.user.name || 'N/A',
        transactionId: payment.transaction_id || `CRS-${payment.id}`,
        amount: payment.amount?.toNumber() || 0,
        date: payment.payment_date || new Date(),
        paymentType: 'Course Enrollment',
        paymentPlan: payment.payment_type || 'One Time',
        invoiceFile: undefined, // You can add invoice file logic if available
      }));

      const eventTransactions: RecentTransaction[] = eventPayments.map(payment => ({
        userId: payment.user.id,
        username: payment.user.username || payment.user.name || 'N/A',
        transactionId: payment.transaction_id || `EVT-${payment.id}`,
        amount: payment.amount?.toNumber() || 0,
        date: payment.payment_date || new Date(),
        paymentType: 'Event Booking',
        paymentPlan: 'One Time', // Events are typically one-time payments
        invoiceFile: payment.invoice_file || undefined,
      }));

      // Combine and sort by date
      const allTransactions = [...courseTransactions, ...eventTransactions]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10); // Get top 10 most recent

      return allTransactions;
    } catch (error) {
      console.error('Error in getRecentTransactions:', error);
      return [];
    }
  }
}