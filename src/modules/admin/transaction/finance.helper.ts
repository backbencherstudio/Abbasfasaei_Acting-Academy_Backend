import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateFinanceDto,
  CreateManualPaymentDto,
} from './dto/create-transaction.dto';
import { UpdateFinanceDto } from './dto/update-transaction.dto';
import { PaymentType, TransactionsQueryDto } from './dto/query-transaction.dto';
import {
  ItemType,
  EnrollmentStatus,
  EnrollmentStep,
  InstallmentInterval,
  InstallmentPlanStatus,
  InstallmentStatus,
  OrderItemType,
  OrderStatus,
  PaymentGateway,
  PaymentMode,
  PaymentTransactionStatus,
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

  async getAllTransactions(query: TransactionsQueryDto) {
    const { search, payment_type, date } = query;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const normalizedSearch = (search || '').trim();
    const where: any = {
      ...(payment_type !== 'MONTHLY' && payment_type !== 'ONE_TIME'
        ? {}
        : { metadata: { path: ['payment_type'], equals: payment_type } }),
      ...(date
        ? {
            paid_at: {
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
          order_id: {
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
      this.prisma.paymentTransaction.findMany({
        where,
        select: {
          id: true,
          transaction_ref: true,
          amount: true,
          paid_at: true,
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
          order: {
            select: {
              item_type: true,
            },
          },
        },
        orderBy: {
          paid_at: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.paymentTransaction.count({ where }),
    ]);

    return {
      success: true,
      data: transactions.map((transaction: any) => ({
        userId: transaction.user.id,
        username: transaction.user.name || transaction.user.username || 'N/A',
        transactionId: transaction.transaction_ref || `TRX-${transaction.id}`,
        amount: transaction.amount?.toNumber() || 0,
        date: transaction.paid_at || transaction.created_at,
        paymentType:
          transaction.order?.item_type === 'EVENT_TICKET'
            ? 'Event Booking'
            : 'Course Enrollment',
        paymentPlan:
          transaction.metadata?.payment_type == 'MONTHLY'
            ? 'Monthly Instalment'
            : 'One Time',
        source:
          transaction.gateway === PaymentGateway.MANUAL
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
    const paymentStatus = body.paymentStatus || OrderStatus.PAID;
    const transactionStatus =
      body.transactionStatus || PaymentTransactionStatus.SUCCESS;
    const currency = (body.currency || 'USD').toUpperCase();
    const paymentMethod = body.paymentMethod || 'manual';

    if (
      itemType === ItemType.COURSE_ENROLLMENT &&
      !body.courseId &&
      !body.enrollmentId
    ) {
      throw new BadRequestException(
        'Course ID or enrollment ID is required for course payments',
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

    const enrollment =
      itemType === ItemType.COURSE_ENROLLMENT
        ? await this.prisma.enrollment.findFirst({
            where: {
              user_id: student.id,
              ...(body.enrollmentId
                ? { id: body.enrollmentId }
                : { course_id: body.courseId }),
            },
            include: {
              course: { select: { id: true, title: true, fee_pence: true } },
              order: {
                include: {
                  installment_plan: { include: { installments: true } },
                },
              },
            },
          })
        : null;

    if (itemType === ItemType.COURSE_ENROLLMENT && !enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    const course = enrollment?.course
      ? enrollment.course
      : itemType === ItemType.COURSE_ENROLLMENT && body.courseId
        ? await this.prisma.course.findUnique({
            where: { id: body.courseId },
            select: { id: true, title: true, fee_pence: true },
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
      const existingTransaction =
        await this.prisma.paymentTransaction.findUnique({
          where: { transaction_ref: body.transactionRef },
          select: { id: true },
        });

      if (existingTransaction) {
        throw new BadRequestException('Transaction reference already exists');
      }
    }

    const amount = Number(body.amount);
    const transactionRef =
      body.transactionRef ||
      `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const result = await this.prisma.$transaction(async (tx) => {
      let order: any = enrollment?.order;

      if (!order) {
        const totalAmount =
          itemType === ItemType.COURSE_ENROLLMENT
            ? Number(course?.fee_pence ?? amount)
            : amount;

        order = await tx.order.create({
          data: {
            order_number: `PAY-${Date.now()}-${Math.floor(
              Math.random() * 1000,
            )}`,
            user_id: student.id,
            total_amount: totalAmount,
            paid_amount: 0,
            due_amount: totalAmount,
            currency,
            status: OrderStatus.PENDING,
            item_type:
              itemType === ItemType.COURSE_ENROLLMENT
                ? OrderItemType.COURSE_ENROLLMENT
                : OrderItemType.EVENT_TICKET,
            payment_mode:
              paymentType === 'MONTHLY'
                ? PaymentMode.INSTALLMENT
                : PaymentMode.FULL,
            notes:
              body.notes ||
              (itemType === ItemType.COURSE_ENROLLMENT
                ? `Manual course payment${course ? ` for ${course.title}` : ''}`
                : `Manual event payment${event ? ` for ${event.name}` : ''}`),
            course_id: course?.id,
            event_id: event?.id,
            subtotal_amount: totalAmount,
          },
        });

        if (enrollment) {
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: { order_id: order.id },
          });
        }
      }

      if (
        itemType === ItemType.COURSE_ENROLLMENT &&
        paymentType === 'MONTHLY'
      ) {
        return this.addManualInstallmentPayment(tx, {
          body,
          enrollmentId: enrollment!.id,
          order,
          amount,
          currency,
          paymentMethod,
          transactionRef,
          transactionStatus: transactionStatus as PaymentTransactionStatus,
          courseTitle: course?.title,
        });
      }

      const orderDueAmount = Number(order.due_amount);
      if (
        itemType === ItemType.COURSE_ENROLLMENT &&
        paymentType !== 'MONTHLY' &&
        amount + 0.001 < orderDueAmount
      ) {
        throw new BadRequestException(
          'Full payment amount must cover the order due amount',
        );
      }

      const transaction = await tx.paymentTransaction.create({
        data: {
          transaction_ref: transactionRef,
          order_id: order.id,
          user_id: student.id,
          amount,
          currency,
          status: transactionStatus as PaymentTransactionStatus,
          gateway: PaymentGateway.MANUAL,
          payment_method: paymentMethod,
          paid_at: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          metadata: {
            manual: true,
            createdBy: 'finance',
            studentId: student.id,
            itemType,
            courseId: course?.id,
            eventId: event?.id,
            paymentStatus,
            payment_type: paymentType,
            notes: body.notes,
          },
        },
      });

      const orderTotalAmount = Number(order.total_amount);
      const nextPaidAmount = Math.min(
        Number(order.paid_amount) + amount,
        orderTotalAmount,
      );
      const nextDueAmount = Math.max(orderTotalAmount - nextPaidAmount, 0);
      const nextStatus =
        nextDueAmount === 0 ? OrderStatus.PAID : OrderStatus.PARTIALLY_PAID;

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paid_amount: nextPaidAmount,
          due_amount: nextDueAmount,
          status: nextStatus,
          payment_mode:
            itemType === ItemType.COURSE_ENROLLMENT
              ? PaymentMode.FULL
              : order.payment_mode,
        },
      });

      if (enrollment && nextStatus === OrderStatus.PAID) {
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: {
            status: EnrollmentStatus.ACTIVE,
            step: EnrollmentStep.COMPLETED,
          },
        });
      }

      return { order: updatedOrder, transaction };
    });

    return {
      success: true,
      message: 'Manual payment added successfully',
      data: result,
    };
  }

  private async addManualInstallmentPayment(
    tx: any,
    params: {
      body: CreateManualPaymentDto;
      enrollmentId: string;
      order: any;
      amount: number;
      currency: string;
      paymentMethod: string;
      transactionRef: string;
      transactionStatus: PaymentTransactionStatus;
      courseTitle?: string;
    },
  ) {
    const {
      body,
      enrollmentId,
      order,
      amount,
      currency,
      paymentMethod,
      transactionRef,
      transactionStatus,
      courseTitle,
    } = params;
    let plan = order.installment_plan;

    if (!plan) {
      const installmentCount =
        body.installmentCount || body.installmentDueDates?.length;

      if (!installmentCount) {
        throw new BadRequestException(
          'Installment count or installment due dates are required to create a plan',
        );
      }

      const totalAmount = Number(order.total_amount);
      const installmentAmount = Number(
        (totalAmount / installmentCount).toFixed(2),
      );
      const dueDates = this.buildInstallmentDueDates(
        installmentCount,
        body.installmentDueDates,
        body.paymentDate,
      );

      plan = await tx.installmentPlan.create({
        data: {
          order_id: order.id,
          total_amount: totalAmount,
          paid_amount: 0,
          due_amount: totalAmount,
          installment_count: installmentCount,
          interval: InstallmentInterval.MONTHLY,
          start_date: dueDates[0],
          next_due_date: dueDates[0],
          status: InstallmentPlanStatus.ACTIVE,
          installments: {
            create: dueDates.map((dueDate, index) => ({
              installment_no: index + 1,
              amount:
                index === dueDates.length - 1
                  ? Number(
                      (
                        totalAmount -
                        installmentAmount * (installmentCount - 1)
                      ).toFixed(2),
                    )
                  : installmentAmount,
              due_date: dueDate,
            })),
          },
        },
        include: { installments: true },
      });
    }

    const pendingInstallments = [...plan.installments]
      .filter((installment) => installment.status !== InstallmentStatus.PAID)
      .sort((a, b) => a.installment_no - b.installment_no);
    const installmentsToPay = body.installmentNumbers?.length
      ? pendingInstallments.filter((installment) =>
          body.installmentNumbers!.includes(installment.installment_no),
        )
      : this.pickInstallmentsByAmount(pendingInstallments, amount);

    if (!installmentsToPay.length) {
      throw new BadRequestException('No payable installments found');
    }

    const selectedAmount = installmentsToPay.reduce(
      (sum, installment) => sum + Number(installment.amount),
      0,
    );

    if (Number(selectedAmount.toFixed(2)) > Number(amount.toFixed(2))) {
      throw new BadRequestException(
        'Amount is less than selected installment total',
      );
    }

    if (
      Math.abs(Number(selectedAmount.toFixed(2)) - Number(amount.toFixed(2))) >
      0.001
    ) {
      throw new BadRequestException(
        'Amount must match selected installment total',
      );
    }

    const transactions = [];
    for (let index = 0; index < installmentsToPay.length; index += 1) {
      const installment = installmentsToPay[index];
      transactions.push(
        await tx.paymentTransaction.create({
          data: {
            transaction_ref:
              installmentsToPay.length === 1
                ? transactionRef
                : `${transactionRef}-${installment.installment_no}`,
            order_id: order.id,
            user_id: order.user_id,
            installment_id: installment.id,
            amount: Number(installment.amount),
            currency,
            status: transactionStatus,
            gateway: PaymentGateway.MANUAL,
            payment_method: paymentMethod,
            paid_at: body.paymentDate ? new Date(body.paymentDate) : new Date(),
            metadata: {
              manual: true,
              createdBy: 'finance',
              payment_type: 'MONTHLY',
              installment_no: installment.installment_no,
              notes: body.notes,
            },
          },
        }),
      );

      await tx.installment.update({
        where: { id: installment.id },
        data: {
          status: InstallmentStatus.PAID,
          paid_at: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        },
      });
    }

    const totalPaid = Number(order.paid_amount) + selectedAmount;
    const totalAmount = Number(order.total_amount);
    const dueAmount = Math.max(totalAmount - totalPaid, 0);
    const nextPending = pendingInstallments.find(
      (installment) =>
        !installmentsToPay.some((paid) => paid.id === installment.id),
    );

    const updatedPlan = await tx.installmentPlan.update({
      where: { id: plan.id },
      data: {
        paid_amount: totalPaid,
        due_amount: dueAmount,
        next_due_date: nextPending?.due_date,
        status:
          dueAmount === 0
            ? InstallmentPlanStatus.COMPLETED
            : InstallmentPlanStatus.ACTIVE,
      },
      include: { installments: true },
    });

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        paid_amount: totalPaid,
        due_amount: dueAmount,
        status: dueAmount === 0 ? OrderStatus.PAID : OrderStatus.PARTIALLY_PAID,
        payment_mode: PaymentMode.INSTALLMENT,
        notes: body.notes || `Manual installment payment for ${courseTitle}`,
      },
    });

    const hasOverdue = updatedPlan.installments.some(
      (installment) =>
        installment.status !== InstallmentStatus.PAID &&
        installment.due_date < new Date(),
    );

    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: hasOverdue
          ? EnrollmentStatus.SUSPENDED
          : EnrollmentStatus.ACTIVE,
        step: EnrollmentStep.COMPLETED,
      },
    });

    return { order: updatedOrder, installment_plan: updatedPlan, transactions };
  }

  private buildInstallmentDueDates(
    installmentCount: number,
    dueDates?: string[],
    paymentDate?: string,
  ) {
    if (dueDates?.length) {
      if (dueDates.length !== installmentCount) {
        throw new BadRequestException(
          'Installment due dates must match installment count',
        );
      }
      return dueDates.map((dueDate) => new Date(dueDate));
    }

    const startDate = paymentDate ? new Date(paymentDate) : new Date();
    return Array.from({ length: installmentCount }, (_, index) => {
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + index);
      return dueDate;
    });
  }

  private pickInstallmentsByAmount(installments: any[], amount: number) {
    const selected = [];
    let remaining = amount;

    for (const installment of installments) {
      const installmentAmount = Number(installment.amount);
      if (remaining + 0.001 < installmentAmount) break;
      selected.push(installment);
      remaining -= installmentAmount;
    }

    return selected;
  }

  async suspendOverdueInstallmentAccess() {
    const now = new Date();
    const overdueInstallments = await this.prisma.installment.findMany({
      where: {
        due_date: { lt: now },
        status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
        installment_plan: {
          status: InstallmentPlanStatus.ACTIVE,
          order: {
            enrollment: { status: EnrollmentStatus.ACTIVE },
          },
        },
      },
      select: {
        id: true,
        installment_plan: {
          select: {
            id: true,
            order: {
              select: {
                enrollment: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!overdueInstallments.length) return { updated: 0 };

    const enrollmentIds = [
      ...new Set(
        overdueInstallments
          .map(
            (installment) => installment.installment_plan.order.enrollment?.id,
          )
          .filter(Boolean),
      ),
    ];

    await this.prisma.$transaction([
      this.prisma.installment.updateMany({
        where: { id: { in: overdueInstallments.map((item) => item.id) } },
        data: { status: InstallmentStatus.OVERDUE },
      }),
      this.prisma.installmentPlan.updateMany({
        where: {
          id: {
            in: [
              ...new Set(
                overdueInstallments.map((item) => item.installment_plan.id),
              ),
            ],
          },
        },
        data: { status: InstallmentPlanStatus.OVERDUE },
      }),
      this.prisma.enrollment.updateMany({
        where: { id: { in: enrollmentIds } },
        data: { status: EnrollmentStatus.SUSPENDED },
      }),
    ]);

    return { updated: enrollmentIds.length };
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
        this.prisma.paymentTransaction.aggregate({
          where: {
            status: 'SUCCESS',
            paid_at: {
              gte: currentYearStart,
              lte: currentYearEnd,
            },
          },
          _sum: { amount: true },
        }),
        // All payments from last year
        this.prisma.paymentTransaction.aggregate({
          where: {
            status: 'SUCCESS',
            paid_at: {
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
        this.prisma.paymentTransaction.aggregate({
          where: {
            status: 'SUCCESS',
            order: { item_type: 'COURSE_ENROLLMENT' },
            paid_at: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.paymentTransaction.aggregate({
          where: {
            status: 'SUCCESS',
            order: { item_type: 'COURSE_ENROLLMENT' },
            paid_at: {
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
        this.prisma.paymentTransaction.aggregate({
          where: {
            status: 'SUCCESS',
            order: { item_type: 'EVENT_TICKET' },
            paid_at: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.paymentTransaction.aggregate({
          where: {
            status: 'SUCCESS',
            order: { item_type: 'EVENT_TICKET' },
            paid_at: {
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
        this.prisma.paymentTransaction.aggregate({
          where: {
            status: 'SUCCESS',
            paid_at: {
              gte: currentMonthStart,
              lte: now,
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.paymentTransaction.aggregate({
          where: {
            status: 'SUCCESS',
            paid_at: {
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
