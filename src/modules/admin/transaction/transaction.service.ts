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
    // if (!body.studentId) {
    //   throw new BadRequestException('Student ID is required');
    // }
    // if (!body.amount || Number(body.amount) <= 0) {
    //   throw new BadRequestException('Amount must be greater than zero');
    // }
    // const itemType = body.itemType || ItemType.COURSE_ENROLLMENT;
    // const paymentType = body.paymentType || 'ONE_TIME';
    // const paymentStatus = body.paymentStatus || OrderStatus.PAID;
    // const transactionStatus =
    //   body.transactionStatus || PaymentTransactionStatus.SUCCESS;
    // const currency = (body.currency || 'USD').toUpperCase();
    // const paymentMethod = body.paymentMethod || 'manual';
    // if (
    //   itemType === ItemType.COURSE_ENROLLMENT &&
    //   !body.courseId &&
    //   !body.enrollmentId
    // ) {
    //   throw new BadRequestException(
    //     'Course ID or enrollment ID is required for course payments',
    //   );
    // }
    // if (itemType === ItemType.EVENT_TICKET && !body.eventId) {
    //   throw new BadRequestException('Event ID is required for event payments');
    // }
    // const student = await this.prisma.user.findUnique({
    //   where: { id: body.studentId },
    //   select: { id: true, name: true, username: true, email: true },
    // });
    // if (!student) {
    //   throw new NotFoundException('Student not found');
    // }
    // const enrollment =
    //   itemType === ItemType.COURSE_ENROLLMENT
    //     ? await this.prisma.enrollment.findFirst({
    //         where: {
    //           user_id: student.id,
    //           ...(body.enrollmentId
    //             ? { id: body.enrollmentId }
    //             : { course_id: body.courseId }),
    //         },
    //         include: {
    //           course: { select: { id: true, title: true, fee_pence: true } },
    //           order: {
    //             include: {
    //               installment_plan: { include: { installments: true } },
    //             },
    //           },
    //         },
    //       })
    //     : null;
    // if (itemType === ItemType.COURSE_ENROLLMENT && !enrollment) {
    //   throw new NotFoundException('Enrollment not found');
    // }
    // const course = enrollment?.course
    //   ? enrollment.course
    //   : itemType === ItemType.COURSE_ENROLLMENT && body.courseId
    //     ? await this.prisma.course.findUnique({
    //         where: { id: body.courseId },
    //         select: { id: true, title: true, fee_pence: true },
    //       })
    //     : null;
    // if (itemType === ItemType.COURSE_ENROLLMENT && !course) {
    //   throw new NotFoundException('Course not found');
    // }
    // const event =
    //   itemType === ItemType.EVENT_TICKET && body.eventId
    //     ? await this.prisma.event.findUnique({
    //         where: { id: body.eventId },
    //         select: { id: true, name: true },
    //       })
    //     : null;
    // if (itemType === ItemType.EVENT_TICKET && !event) {
    //   throw new NotFoundException('Event not found');
    // }
    // if (body.transactionRef) {
    //   const existingTransaction =
    //     await this.prisma.paymentTransaction.findUnique({
    //       where: { transaction_ref: body.transactionRef },
    //       select: { id: true },
    //     });
    //   if (existingTransaction) {
    //     throw new BadRequestException('Transaction reference already exists');
    //   }
    // }
    // const amount = Number(body.amount);
    // const transactionRef =
    //   body.transactionRef ||
    //   `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // const result = await this.prisma.$transaction(async (tx) => {
    //   let order: any = enrollment?.order;
    //   if (!order) {
    //     const totalAmount =
    //       itemType === ItemType.COURSE_ENROLLMENT
    //         ? Number(course?.fee_pence ?? amount)
    //         : amount;
    //     order = await tx.order.create({
    //       data: {
    //         order_number: `PAY-${Date.now()}-${Math.floor(
    //           Math.random() * 1000,
    //         )}`,
    //         user_id: student.id,
    //         total_amount: totalAmount,
    //         paid_amount: 0,
    //         due_amount: totalAmount,
    //         currency,
    //         status: OrderStatus.PENDING,
    //         item_type:
    //           itemType === ItemType.COURSE_ENROLLMENT
    //             ? OrderItemType.COURSE_ENROLLMENT
    //             : OrderItemType.EVENT_TICKET,
    //         payment_mode:
    //           paymentType === 'MONTHLY'
    //             ? PaymentMode.INSTALLMENT
    //             : PaymentMode.FULL,
    //         notes:
    //           body.notes ||
    //           (itemType === ItemType.COURSE_ENROLLMENT
    //             ? `Manual course payment${course ? ` for ${course.title}` : ''}`
    //             : `Manual event payment${event ? ` for ${event.name}` : ''}`),
    //         course_id: course?.id,
    //         event_id: event?.id,
    //         subtotal_amount: totalAmount,
    //       },
    //     });
    //     if (enrollment) {
    //       await tx.enrollment.update({
    //         where: { id: enrollment.id },
    //         data: { order_id: order.id },
    //       });
    //     }
    //   }
    //   if (
    //     itemType === ItemType.COURSE_ENROLLMENT &&
    //     paymentType === 'MONTHLY'
    //   ) {
    //     return this.addManualInstallmentPayment(tx, {
    //       body,
    //       enrollmentId: enrollment!.id,
    //       order,
    //       amount,
    //       currency,
    //       paymentMethod,
    //       transactionRef,
    //       transactionStatus: transactionStatus as PaymentTransactionStatus,
    //       courseTitle: course?.title,
    //     });
    //   }
    //   const orderDueAmount = Number(order.due_amount);
    //   if (
    //     itemType === ItemType.COURSE_ENROLLMENT &&
    //     paymentType !== 'MONTHLY' &&
    //     amount + 0.001 < orderDueAmount
    //   ) {
    //     throw new BadRequestException(
    //       'Full payment amount must cover the order due amount',
    //     );
    //   }
    //   const transaction = await tx.paymentTransaction.create({
    //     data: {
    //       transaction_ref: transactionRef,
    //       order_id: order.id,
    //       user_id: student.id,
    //       amount,
    //       currency,
    //       status: transactionStatus as PaymentTransactionStatus,
    //       gateway: PaymentGateway.MANUAL,
    //       payment_method: paymentMethod,
    //       paid_at: body.paymentDate ? new Date(body.paymentDate) : new Date(),
    //       metadata: {
    //         manual: true,
    //         createdBy: 'finance',
    //         studentId: student.id,
    //         itemType,
    //         courseId: course?.id,
    //         eventId: event?.id,
    //         paymentStatus,
    //         payment_type: paymentType,
    //         notes: body.notes,
    //       },
    //     },
    //   });
    //   const orderTotalAmount = Number(order.total_amount);
    //   const nextPaidAmount = Math.min(
    //     Number(order.paid_amount) + amount,
    //     orderTotalAmount,
    //   );
    //   const nextDueAmount = Math.max(orderTotalAmount - nextPaidAmount, 0);
    //   const nextStatus =
    //     nextDueAmount === 0 ? OrderStatus.PAID : OrderStatus.PARTIALLY_PAID;
    //   const updatedOrder = await tx.order.update({
    //     where: { id: order.id },
    //     data: {
    //       paid_amount: nextPaidAmount,
    //       due_amount: nextDueAmount,
    //       status: nextStatus,
    //       payment_mode:
    //         itemType === ItemType.COURSE_ENROLLMENT
    //           ? PaymentMode.FULL
    //           : order.payment_mode,
    //     },
    //   });
    //   if (enrollment && nextStatus === OrderStatus.PAID) {
    //     await tx.enrollment.update({
    //       where: { id: enrollment.id },
    //       data: {
    //         status: EnrollmentStatus.ACTIVE,
    //         step: EnrollmentStep.COMPLETED,
    //       },
    //     });
    //   }
    //   return { order: updatedOrder, transaction };
    // });
    // return {
    //   success: true,
    //   message: 'Manual payment added successfully',
    //   data: result,
    // };
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
