import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFinanceDto } from './dto/create-finance.dto';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { UpdateFinanceDto } from './dto/update-finance.dto';
import { PaymentType, TransactionsQueryDto } from './dto/query-finance.dto';
import {
  ItemType,
  OrderStatus,
  PaymentGateway,
  TransactionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class FinanceService {
  private logger = new Logger(FinanceService.name);
  constructor(private prisma: PrismaService) {}

  // async getDashboardData(userId: string) {
  //   try {
  //     const userRole = await this.getUserRole(userId);

  //     if (
  //       userRole === 'finance' ||
  //       userRole === 'Finance' ||
  //       userRole === 'FINANCE'
  //     ) {
  //       return this.getFinanceDashboard();
  //     } else {
  //       return { message: 'Restricted', role: userRole };
  //     }
  //   } catch (error) {
  //     this.logger.error(
  //       `Error getting dashboard data for user ${userId}: ${error.message}`,
  //     );
  //     throw error;
  //   }
  // }

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
  // private getCurrentMonthDateRange() {
  //   try {
  //     const now = new Date();
  //     const start = new Date(now.getFullYear(), now.getMonth(), 1);
  //     const end = new Date(
  //       now.getFullYear(),
  //       now.getMonth() + 1,
  //       0,
  //       23,
  //       59,
  //       59,
  //       999,
  //     );
  //     return { start, end };
  //   } catch (error) {
  //     this.logger.error(
  //       `Error getting current month date range: ${error.message}`,
  //     );
  //     throw error;
  //   }
  // }

  // private getPreviousMonthDateRange() {
  //   try {
  //     const now = new Date();
  //     const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  //     const previousMonthEnd = new Date(currentMonthStart.getTime() - 1);
  //     const previousMonthStart = new Date(
  //       previousMonthEnd.getFullYear(),
  //       previousMonthEnd.getMonth(),
  //       1,
  //     );
  //     return { start: previousMonthStart, end: previousMonthEnd };
  //   } catch (error) {
  //     this.logger.error(
  //       `Error getting previous month date range: ${error.message}`,
  //     );
  //     throw error;
  //   }
  // }

  // private calculatePercentageChange(current: number, previous: number): number {
  //   try {
  //     if (previous === 0) return current > 0 ? 100 : 0;
  //     return ((current - previous) / previous) * 100;
  //   } catch (error) {
  //     this.logger.error(
  //       `Error calculating percentage change: ${error.message}`,
  //     );
  //     return 0;
  //   }
  // }

  // Finacne DASHBOARD FUNCTIONS

  // INDEPENDENT FUNCTIONS FOR ADMIN
  // private async getTotalStudents() {
  //   try {
  //     const currentMonth = this.getCurrentMonthDateRange();
  //     const previousMonth = this.getPreviousMonthDateRange();

  //     const [current, previous] = await Promise.all([
  //       this.prisma.user.count({
  //         where: {
  //           type: 'student',
  //           created_at: { lte: currentMonth.end },
  //         },
  //       }),
  //       this.prisma.user.count({
  //         where: {
  //           type: 'student',
  //           created_at: { lte: previousMonth.end },
  //         },
  //       }),
  //     ]);

  //     return {
  //       current,
  //       previous,
  //       percentageChange: this.calculatePercentageChange(current, previous),
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error getting total students: ${error.message}`);
  //     return { current: 0, previous: 0, percentageChange: 0 };
  //   }
  // }

  // private async getTotalOngoingCourses() {
  //   try {
  //     const currentMonth = this.getCurrentMonthDateRange();
  //     const previousMonth = this.getPreviousMonthDateRange();

  //     const [current, previous] = await Promise.all([
  //       this.prisma.course.count({
  //         where: {
  //           status: 'ACTIVE',
  //           modules: {
  //             some: {
  //               classes: {
  //                 some: {
  //                   start_date: {
  //                     lte: currentMonth.end,
  //                     gte: currentMonth.start,
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       }),
  //       this.prisma.course.count({
  //         where: {
  //           status: 'ACTIVE',
  //           modules: {
  //             some: {
  //               classes: {
  //                 some: {
  //                   start_date: {
  //                     lte: previousMonth.end,
  //                     gte: previousMonth.start,
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       }),
  //     ]);

  //     return {
  //       current,
  //       previous,
  //       percentageChange: this.calculatePercentageChange(current, previous),
  //     };
  //   } catch (error) {
  //     this.logger.error(
  //       `Error getting total ongoing courses: ${error.message}`,
  //     );
  //     return { current: 0, previous: 0, percentageChange: 0 };
  //   }
  // }

  // private async getMonthlyRevenue() {
  //   try {
  //     const currentMonth = this.getCurrentMonthDateRange();
  //     const previousMonth = this.getPreviousMonthDateRange();

  //     const [currentRevenue, previousRevenue] = await Promise.all([
  //       this.prisma.transaction.aggregate({
  //         _sum: { amount: true },
  //         where: {
  //           status: 'SUCCESS',
  //           payment_date: {
  //             gte: currentMonth.start,
  //             lte: currentMonth.end,
  //           },
  //         },
  //       }),
  //       this.prisma.transaction.aggregate({
  //         _sum: { amount: true },
  //         where: {
  //           status: 'SUCCESS',
  //           payment_date: {
  //             gte: previousMonth.start,
  //             lte: previousMonth.end,
  //           },
  //         },
  //       }),
  //     ]);

  //     const current = Number(currentRevenue._sum.amount) || 0;
  //     const previous = Number(previousRevenue._sum.amount) || 0;

  //     return {
  //       current,
  //       previous,
  //       percentageChange: this.calculatePercentageChange(current, previous),
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error getting monthly revenue: ${error.message}`);
  //     return { current: 0, previous: 0, percentageChange: 0 };
  //   }
  // }

  // private async getTotalTeachers() {
  //   try {
  //     const currentMonth = this.getCurrentMonthDateRange();
  //     const previousMonth = this.getPreviousMonthDateRange();

  //     const [current, previous] = await Promise.all([
  //       this.prisma.user.count({
  //         where: {
  //           type: 'teacher',
  //           created_at: { lte: currentMonth.end },
  //         },
  //       }),
  //       this.prisma.user.count({
  //         where: {
  //           type: 'teacher',
  //           created_at: { lte: previousMonth.end },
  //         },
  //       }),
  //     ]);

  //     return {
  //       current,
  //       previous,
  //       percentageChange: this.calculatePercentageChange(current, previous),
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error getting total teachers: ${error.message}`);
  //     return { current: 0, previous: 0, percentageChange: 0 };
  //   }
  // }

  // private async getRecentEnrollments(limit: number = 4) {
  //   try {
  //     return await this.prisma.enrollment.findMany({
  //       where: {
  //         status: { not: 'PENDING' },
  //       },
  //       include: {
  //         course: { select: { title: true } },
  //         user: { select: { name: true, email: true } },
  //       },
  //       orderBy: { created_at: 'desc' },
  //       take: limit,
  //     });
  //   } catch (error) {
  //     this.logger.error(`Error getting recent enrollments: ${error.message}`);
  //     return [];
  //   }
  // }

  // private async getAttendanceTracking() {
  //   try {
  //     const recentClasses = await this.prisma.moduleClass.findMany({
  //       where: {
  //         start_date: { lte: new Date() },
  //       },
  //       include: {
  //         attendances: {
  //           where: { status: 'PRESENT' },
  //         },
  //         module: {
  //           include: {
  //             course: { select: { title: true } },
  //           },
  //         },
  //       },
  //       orderBy: { start_date: 'desc' },
  //       take: 5,
  //     });

  //     return recentClasses.map((cls) => ({
  //       classTitle: cls.class_title,
  //       course: cls.module.course.title,
  //       totalStudents: cls.attendances.length,
  //       date: cls.start_date,
  //     }));
  //   } catch (error) {
  //     this.logger.error(`Error getting attendance tracking: ${error.message}`);
  //     return [];
  //   }
  // }

  async register(body: CreateFinanceDto) {
    try {
      // Ensure Finance role exists or create it
      let financeRole = await this.prisma.role.findFirst({
        where: { name: { equals: 'FINANCE', mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (!financeRole) {
        financeRole = await this.prisma.role.create({
          data: { name: 'FINANCE', title: 'Finance' },
          select: { id: true, name: true },
        });
      }

      const user = await this.prisma.user.findFirst({
        where: { email: body.email },
      });

      if (user) {
        throw new BadRequestException('Finance already exists');
      }

      const hashedPassword = await bcrypt.hash(
        body.password || 'finance123',
        10,
      );

      const finance = await this.prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          phone_number: body.phone,
          experience_level: body.experienceLevel,
          joined_at: body.joined_at,
          type: 'finance',
          password: hashedPassword,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
          experience_level: true,
          joined_at: true,
          type: true,
        },
      });

      await this.prisma.roleUser.create({
        data: {
          user_id: finance.id,
          role_id: financeRole.id,
        },
      });

      return {
        success: true,
        message: 'Finance registered successfully',
        data: finance,
      };
    } catch (error) {
      this.logger.error(`Error registering payment: ${error.message}`);
      throw error;
    }
  }

  async update(body: UpdateFinanceDto) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { email: body.email },
      });

      if (!user) {
        throw new BadRequestException('Finance not found');
      }

      const data: any = {};
      if (body.name) {
        data.name = body.name;
      }
      if (body.email) {
        data.email = body.email;
      }
      if (body.phone) {
        data.phone_number = body.phone;
      }
      if (body.experienceLevel) {
        data.experience_level = body.experienceLevel;
      }
      if (body.joined_at) {
        data.joined_at = body.joined_at;
      }
      const finance = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...data,
          type: 'finance',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
          experience_level: true,
          joined_at: true,
          type: true,
        },
      });

      return {
        success: true,
        message: 'Finance updated successfully',
        data: finance,
      };
    } catch (error) {
      this.logger.error(`Error updating payment: ${error.message}`);
      throw error;
    }
  }

  async getStats() {
    const [
      totalRevenueThisYear,
      courseRevenue,
      eventsRevenue,
      currentMonthRevenue,
    ] = await Promise.all([
      this.getTotalRevenueThisYear(),
      this.getCourseRevenue(),
      this.getEventsRevenue(),
      this.getCurrentMonthRevenue(),
    ]);

    return {
      totalRevenueThisYear,
      courseRevenue,
      eventsRevenue,
      currentMonthRevenue,
    };
  }

  async getAllTransactions(query: TransactionsQueryDto) {
    const { search, payment_type, date } = query;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const normalizedSearch = (search || '').trim();
    const where: any = {
      ...(payment_type !== 'MONTHLY' && payment_type !== 'ONE_TIME'
        ? {}
        : { payment_type }),
      ...(date
        ? {
            payment_date: {
              gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
              lte: new Date(new Date(date).setHours(23, 59, 59, 999)),
            },
          }
        : {}),
    };

    if (normalizedSearch) {
      where.OR = [
        {
          transaction_ref: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
        },
        {
          payment_method: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
        },
        {
          currency: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
        },
        {
          paymentId: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
        },
        {
          user: {
            OR: [
              {
                name: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            ],
          },
        },
      ];
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        select: {
          id: true,
          transaction_ref: true,
          payment_type: true,
          amount: true,
          payment_date: true,
          receipt_url: true,
          created_at: true,
          gateway: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
          payment: {
            select: {
              item_type: true,
            },
          },
        },
        orderBy: {
          payment_date: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      success: true,
      data: transactions.map((transaction) => ({
        userId: transaction.user.id,
        username: transaction.user.name || transaction.user.username || 'N/A',
        transactionId: transaction.transaction_ref || `TRX-${transaction.id}`,
        amount: transaction.amount?.toNumber() || 0,
        date: transaction.payment_date || transaction.created_at,
        paymentType:
          transaction.payment?.item_type === 'EVENT_TICKET'
            ? 'Event Booking'
            : 'Course Enrollment',
        paymentPlan:
          transaction.payment_type == 'MONTHLY'
            ? 'Monthly Instalment'
            : 'One Time',
        source:
          transaction.gateway === PaymentGateway.STRIPE_MANUAL_ENTRY
            ? 'Manual Entry'
            : 'Stripe',
        invoiceFile: transaction.receipt_url || undefined,
      })),
      meta_data: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        search: normalizedSearch,
        payment_type: query.payment_type,
        date: query.date,
      },
    };
  }

  async addManualPayment(body: CreateManualPaymentDto) {
    if (!body.studentId) {
      throw new BadRequestException('Student ID is required');
    }

    if (!body.amount || Number(body.amount) <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const itemType = body.itemType || ItemType.COURSE_ENROLLMENT;
    const paymentType = body.paymentType || 'ONE_TIME';
    const paymentStatus = body.paymentStatus || OrderStatus.COMPLETED;
    const transactionStatus =
      body.transactionStatus || TransactionStatus.SUCCESS;
    const currency = (body.currency || 'USD').toUpperCase();
    const paymentMethod = body.paymentMethod || 'stripe';

    if (itemType === ItemType.COURSE_ENROLLMENT && !body.courseId) {
      throw new BadRequestException(
        'Course ID is required for course payments',
      );
    }

    if (itemType === ItemType.EVENT_TICKET && !body.eventId) {
      throw new BadRequestException('Event ID is required for event payments');
    }

    const student = await this.prisma.user.findUnique({
      where: { id: body.studentId },
      select: { id: true, name: true, username: true, email: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const course =
      itemType === ItemType.COURSE_ENROLLMENT && body.courseId
        ? await this.prisma.course.findUnique({
            where: { id: body.courseId },
            select: { id: true, title: true },
          })
        : null;

    if (itemType === ItemType.COURSE_ENROLLMENT && !course) {
      throw new NotFoundException('Course not found');
    }

    const event =
      itemType === ItemType.EVENT_TICKET && body.eventId
        ? await this.prisma.event.findUnique({
            where: { id: body.eventId },
            select: { id: true, name: true },
          })
        : null;

    if (itemType === ItemType.EVENT_TICKET && !event) {
      throw new NotFoundException('Event not found');
    }

    if (body.transactionRef) {
      const existingTransaction = await this.prisma.transaction.findUnique({
        where: { transaction_ref: body.transactionRef },
        select: { id: true },
      });

      if (existingTransaction) {
        throw new BadRequestException('Transaction reference already exists');
      }
    }

    const amount = Number(body.amount);
    const orderNumber = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const transactionRef =
      body.transactionRef ||
      `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          order_number: orderNumber,
          user_id: student.id,
          total_amount: amount,
          paid_amount: paymentStatus === OrderStatus.COMPLETED ? amount : 0,
          due_amount: paymentStatus === OrderStatus.COMPLETED ? 0 : amount,
          currency,
          status: paymentStatus,
          item_type: itemType,
          payment_type: paymentType,
          installment_amount: paymentType === 'MONTHLY' ? amount : null,
          notes:
            body.notes ||
            (itemType === ItemType.COURSE_ENROLLMENT
              ? `Manual course payment${course ? ` for ${course.title}` : ''}`
              : `Manual event payment${event ? ` for ${event.name}` : ''}`),
          course_id: course?.id,
          event_id: event?.id,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          transaction_ref: transactionRef,
          paymentId: payment.id,
          user_id: student.id,
          amount,
          currency,
          status: transactionStatus,
          gateway: PaymentGateway.STRIPE_MANUAL_ENTRY,
          payment_method: paymentMethod,
          payment_type: paymentType,
          payment_date: body.paymentDate
            ? new Date(body.paymentDate)
            : new Date(),
          metadata: {
            manual: true,
            createdBy: 'finance',
            studentId: student.id,
            itemType,
            courseId: course?.id,
            eventId: event?.id,
            paymentStatus,
            notes: body.notes,
          },
        },
      });

      return { payment, transaction };
    });

    return {
      success: true,
      message: 'Manual payment added successfully',
      data: result,
    };
  }

  private async getTotalRevenueThisYear() {
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

  private async getCourseRevenue() {
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
            payment: { item_type: 'COURSE_ENROLLMENT' },
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
            payment: { item_type: 'COURSE_ENROLLMENT' },
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

  private async getEventsRevenue() {
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
            payment: { item_type: 'EVENT_TICKET' },
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
            payment: { item_type: 'EVENT_TICKET' },
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

  private async getCurrentMonthRevenue() {
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
}
