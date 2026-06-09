import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  EnrollmentStatus,
  EnrollmentStep,
  InstallmentPlanStatus,
  InstallmentStatus,
  ItemType,
  OrderItemType,
  OrderStatus,
  PaymentGateway,
  PaymentMode,
  PaymentTransactionStatus,
  PaymentType,
  Prisma,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionsQueryDto } from './dto/query-transaction.dto';
import { CreateManualPaymentDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('installment-access-queue')
    private readonly installmentAccessQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.installmentAccessQueue.add(
      'suspendOverdueInstallments',
      {},
      {
        jobId: 'suspend-overdue-installments-startup',
        removeOnComplete: true,
        removeOnFail: 25,
      },
    );

    await this.installmentAccessQueue.add(
      'suspendOverdueInstallments',
      {},
      {
        jobId: 'suspend-overdue-installments-hourly',
        repeat: { every: 60 * 60 * 1000 },
        removeOnComplete: true,
        removeOnFail: 25,
      },
    );
  }

  async getStats() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const successTransactionWhere = {
      status: PaymentTransactionStatus.SUCCESS,
      paid_at: { not: null },
    };

    const [
      totalRevenue,
      totalCourseRevenue,
      totalEventRevenue,
      thisMonthRevenue,
    ] = await Promise.all([
      this.prisma.paymentTransaction.aggregate({
        where: successTransactionWhere,
        _sum: { amount: true },
      }),
      this.prisma.paymentTransaction.aggregate({
        where: {
          ...successTransactionWhere,
          order: { item_type: OrderItemType.COURSE_ENROLLMENT },
        },
        _sum: { amount: true },
      }),
      this.prisma.paymentTransaction.aggregate({
        where: {
          ...successTransactionWhere,
          order: { item_type: OrderItemType.EVENT_TICKET },
        },
        _sum: { amount: true },
      }),
      this.prisma.paymentTransaction.aggregate({
        where: {
          ...successTransactionWhere,
          paid_at: {
            gte: currentMonthStart,
            lte: now,
          },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      success: true,
      data: {
        total_revenue: totalRevenue._sum.amount?.toNumber() || 0,
        total_course_revenue: totalCourseRevenue._sum.amount?.toNumber() || 0,
        total_event_revenue: totalEventRevenue._sum.amount?.toNumber() || 0,
        current_month_revenue: thisMonthRevenue._sum.amount?.toNumber() || 0,
      },
    };
  }

  async getAllTransactions(query: TransactionsQueryDto) {
    const { search, payment_type, status, date } = query;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const normalizedSearch = (search || '').trim();

    const where: Prisma.PaymentTransactionWhereInput = {
      ...(payment_type && payment_type !== 'ALL'
        ? { metadata: { path: ['payment_type'], equals: payment_type } }
        : {}),
      ...(status
        ? { status: status as unknown as PaymentTransactionStatus }
        : {}),
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
                username: {
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
          payment_method: true,
          metadata: true,
          status: true,
          currency: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          order: {
            select: {
              id: true,
              item_type: true,
              order_number: true,
              course: { select: { id: true, title: true } },
              event: { select: { id: true, name: true } },
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
      data: transactions.map((transaction) => {
        const metadata = transaction.metadata as {
          payment_type?: string;
        } | null;

        return {
          user_id: transaction.user.id,
          name: transaction.user.name || 'N/A',
          transaction_ref:
            transaction.transaction_ref || `TRX-${transaction.id}`,
          amount: transaction.amount?.toNumber() || 0,
          currency: transaction.currency,
          status: transaction.status,
          paid_at: transaction.paid_at || transaction.created_at,
          payment_plan:
            metadata?.payment_type === 'MONTHLY'
              ? 'Monthly Instalment'
              : 'One Time',
          source:
            transaction.gateway === PaymentGateway.MANUAL
              ? 'Manual Entry'
              : 'Stripe',
          invoice_file: transaction.receipt_url || undefined,
          order: transaction.order
            ? {
                id: transaction.order.id,
                order_number: transaction.order.order_number,
                item_type: transaction.order.item_type,
                course: transaction.order.course,
                event: transaction.order.event,
              }
            : null,
        };
      }),
      meta_data: {
        page,
        limit,
        total,
        search: normalizedSearch,
        payment_type,
        status,
        date,
      },
    };
  }

  async addManualPayment(body: CreateManualPaymentDto) {
    if (!body.studentId) {
      throw new BadRequestException('Student ID is required');
    }

    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const itemType = body.itemType || ItemType.COURSE_ENROLLMENT;
    const paymentType = body.paymentType || PaymentType.ONE_TIME;
    const transactionStatus =
      body.transactionStatus || PaymentTransactionStatus.SUCCESS;
    const isSuccess = transactionStatus === PaymentTransactionStatus.SUCCESS;
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
    if (!student) throw new NotFoundException('Student not found');

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

    const event =
      itemType === ItemType.EVENT_TICKET
        ? await this.prisma.event.findUnique({
            where: { id: body.eventId },
            select: { id: true, name: true, amount_pence: true },
          })
        : null;
    if (itemType === ItemType.EVENT_TICKET && !event) {
      throw new NotFoundException('Event not found');
    }

    const course = enrollment?.course;
    if (itemType === ItemType.COURSE_ENROLLMENT && !course) {
      throw new NotFoundException('Course not found');
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

    const transactionRef =
      body.transactionRef ||
      `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const totalAmount =
        itemType === ItemType.COURSE_ENROLLMENT
          ? Number(course?.fee_pence ?? amount)
          : Number(event?.amount_pence ?? amount);

      let order = enrollment?.order;
      if (!order) {
        order = await tx.order.create({
          data: {
            order_number: `PAY-${Date.now()}-${Math.floor(
              Math.random() * 1000,
            )}`,
            user_id: student.id,
            item_type:
              itemType === ItemType.COURSE_ENROLLMENT
                ? OrderItemType.COURSE_ENROLLMENT
                : OrderItemType.EVENT_TICKET,
            payment_mode:
              paymentType === PaymentType.MONTHLY
                ? PaymentMode.INSTALLMENT
                : PaymentMode.MANUAL,
            status: OrderStatus.PENDING,
            subtotal_amount: totalAmount,
            total_amount: totalAmount,
            paid_amount: 0,
            due_amount: totalAmount,
            currency,
            notes:
              body.notes ||
              (itemType === ItemType.COURSE_ENROLLMENT
                ? `Manual course payment for ${course?.title}`
                : `Manual event payment for ${event?.name}`),
            course_id: course?.id,
            event_id: event?.id,
          },
          include: {
            installment_plan: { include: { installments: true } },
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
        paymentType === PaymentType.MONTHLY
      ) {
        return this.addManualInstallmentPayment(tx, {
          amount,
          body,
          currency,
          enrollmentId: enrollment!.id,
          isSuccess,
          order,
          paymentMethod,
          transactionRef,
          transactionStatus,
        });
      }

      if (isSuccess && amount + 0.001 < Number(order.due_amount)) {
        throw new BadRequestException(
          'Payment amount must cover the order due amount',
        );
      }

      const transaction = await tx.paymentTransaction.create({
        data: {
          transaction_ref: transactionRef,
          order_id: order.id,
          user_id: student.id,
          amount,
          currency,
          status: transactionStatus,
          gateway: PaymentGateway.MANUAL,
          payment_method: paymentMethod,
          paid_at: isSuccess
            ? body.paymentDate
              ? new Date(body.paymentDate)
              : new Date()
            : null,
          metadata: {
            manual: true,
            studentId: student.id,
            itemType,
            courseId: course?.id,
            eventId: event?.id,
            payment_type: paymentType,
            notes: body.notes,
          },
        },
      });

      if (!isSuccess) return { order, transaction };

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paid_amount: Number(order.total_amount),
          due_amount: 0,
          status: OrderStatus.PAID,
          payment_mode:
            itemType === ItemType.COURSE_ENROLLMENT
              ? PaymentMode.MANUAL
              : order.payment_mode,
        },
      });

      if (enrollment) {
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: {
            status: EnrollmentStatus.ACTIVE,
            step: EnrollmentStep.COMPLETED,
          },
        });
      }

      if (event) {
        const existingRegistration = await tx.eventRegistration.findFirst({
          where: { user_id: student.id, event_id: event.id },
        });

        if (!existingRegistration) {
          await tx.eventRegistration.create({
            data: {
              user_id: student.id,
              event_id: event.id,
              order_id: order.id,
              ticket_number: `TKT-${Math.random()
                .toString(36)
                .substring(2, 6)
                .toUpperCase()}-${Date.now().toString().slice(-4)}`,
              status: 'CONFIRMED',
            },
          });
        }
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
    tx: Prisma.TransactionClient,
    params: {
      amount: number;
      body: CreateManualPaymentDto;
      currency: string;
      enrollmentId: string;
      isSuccess: boolean;
      order: Prisma.OrderGetPayload<{
        include: { installment_plan: { include: { installments: true } } };
      }>;
      paymentMethod: string;
      transactionRef: string;
      transactionStatus: PaymentTransactionStatus;
    },
  ) {
    const {
      amount,
      body,
      currency,
      enrollmentId,
      isSuccess,
      order,
      paymentMethod,
      transactionRef,
      transactionStatus,
    } = params;

    let installmentPlan = order.installment_plan;
    if (!installmentPlan) {
      const installmentCount =
        body.installmentCount || body.installmentDueDates?.length || 1;
      if (installmentCount < 1) {
        throw new BadRequestException('Installment count must be at least one');
      }

      const dueDates =
        body.installmentDueDates?.map((date) => new Date(date)) ||
        Array.from({ length: installmentCount }, (_, index) => {
          const date = new Date();
          date.setMonth(date.getMonth() + index);
          return date;
        });

      if (dueDates.length !== installmentCount) {
        throw new BadRequestException(
          'Installment due dates must match installment count',
        );
      }

      const totalAmountInCents = Math.round(Number(order.total_amount) * 100);
      const baseInstallmentAmount = Math.floor(
        totalAmountInCents / installmentCount,
      );
      const remainderAmount = totalAmountInCents % installmentCount;

      installmentPlan = await tx.installmentPlan.create({
        data: {
          order_id: order.id,
          total_amount: order.total_amount,
          paid_amount: 0,
          due_amount: order.total_amount,
          installment_count: installmentCount,
          start_date: dueDates[0],
          end_date: dueDates[dueDates.length - 1],
          next_due_date: dueDates[0],
          status: InstallmentPlanStatus.ACTIVE,
          installments: {
            create: dueDates.map((dueDate, index) => {
              const amountInCents =
                baseInstallmentAmount + (index < remainderAmount ? 1 : 0);

              return {
                installment_no: index + 1,
                amount: Number((amountInCents / 100).toFixed(2)),
                due_date: dueDate,
                status: InstallmentStatus.PENDING,
              };
            }),
          },
        },
        include: { installments: true },
      });
    }

    const openInstallments = [...installmentPlan.installments]
      .filter(
        (installment) =>
          installment.status === InstallmentStatus.PENDING ||
          installment.status === InstallmentStatus.OVERDUE,
      )
      .filter((installment) =>
        body.installmentNumbers?.length
          ? body.installmentNumbers.includes(installment.installment_no)
          : true,
      )
      .sort((a, b) => a.installment_no - b.installment_no);

    if (!openInstallments.length) {
      throw new BadRequestException('No payable installments found');
    }

    let remainingAmount = amount;
    const paidInstallmentIds: string[] = [];
    let appliedAmount = 0;
    for (const installment of openInstallments) {
      const installmentAmount = Number(installment.amount);
      if (remainingAmount + 0.001 < installmentAmount) break;
      paidInstallmentIds.push(installment.id);
      appliedAmount += installmentAmount;
      remainingAmount = Number(
        (remainingAmount - installmentAmount).toFixed(2),
      );
    }

    if (!paidInstallmentIds.length) {
      throw new BadRequestException(
        'Payment amount is less than the next installment amount',
      );
    }

    if (Math.abs(amount - appliedAmount) > 0.001) {
      throw new BadRequestException(
        'Installment payment amount must match full installment amount(s)',
      );
    }

    const paidAt = body.paymentDate ? new Date(body.paymentDate) : new Date();
    const transaction = await tx.paymentTransaction.create({
      data: {
        transaction_ref: transactionRef,
        order_id: order.id,
        user_id: order.user_id,
        installment_id: paidInstallmentIds[0],
        amount,
        currency,
        status: transactionStatus,
        gateway: PaymentGateway.MANUAL,
        payment_method: paymentMethod,
        paid_at: isSuccess ? paidAt : null,
        metadata: {
          manual: true,
          enrollmentId,
          installmentIds: paidInstallmentIds,
          payment_type: PaymentType.MONTHLY,
          notes: body.notes,
        },
      },
    });

    if (!isSuccess)
      return { order, installment_plan: installmentPlan, transaction };

    await tx.installment.updateMany({
      where: { id: { in: paidInstallmentIds } },
      data: {
        status: InstallmentStatus.PAID,
        paid_at: paidAt,
      },
    });

    const nextPaidAmount = Math.min(
      Number(order.paid_amount) + appliedAmount,
      Number(order.total_amount),
    );
    const nextDueAmount = Math.max(
      Number(order.total_amount) - nextPaidAmount,
      0,
    );
    const nextPendingInstallment = installmentPlan.installments
      .filter(
        (installment) =>
          !paidInstallmentIds.includes(installment.id) &&
          installment.status !== InstallmentStatus.PAID,
      )
      .sort((a, b) => a.installment_no - b.installment_no)[0];
    const isCompleted = nextDueAmount === 0 || !nextPendingInstallment;

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        paid_amount: nextPaidAmount,
        due_amount: isCompleted ? 0 : nextDueAmount,
        status: isCompleted ? OrderStatus.PAID : OrderStatus.PARTIALLY_PAID,
        payment_mode: PaymentMode.INSTALLMENT,
      },
    });

    const updatedPlan = await tx.installmentPlan.update({
      where: { id: installmentPlan.id },
      data: {
        paid_amount: nextPaidAmount,
        due_amount: isCompleted ? 0 : nextDueAmount,
        next_due_date: nextPendingInstallment?.due_date,
        status: isCompleted
          ? InstallmentPlanStatus.COMPLETED
          : InstallmentPlanStatus.ACTIVE,
      },
    });

    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: EnrollmentStatus.ACTIVE,
        step: isCompleted ? EnrollmentStep.COMPLETED : EnrollmentStep.PAYMENT,
      },
    });

    return {
      order: updatedOrder,
      installment_plan: updatedPlan,
      transaction,
      paid_installment_ids: paidInstallmentIds,
    };
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
}
