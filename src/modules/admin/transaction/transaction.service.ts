import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  OrderItemType,
  PaymentGateway,
  PaymentTransactionStatus,
  Prisma,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionsQueryDto } from './dto/query-transaction.dto';
import { FinanceAndPaymentsService } from './financeandpayments.helper';
import { FinanceService } from './finance.helper';

@Injectable()
export class TransactionService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly financeAndPaymentsService: FinanceAndPaymentsService,
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
              username: true,
              email: true,
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
          userId: transaction.user.id,
          username: transaction.user.name || transaction.user.username || 'N/A',
          email: transaction.user.email,
          transactionId: transaction.transaction_ref || `TRX-${transaction.id}`,
          amount: transaction.amount?.toNumber() || 0,
          currency: transaction.currency,
          status: transaction.status,
          date: transaction.paid_at || transaction.created_at,
          paymentType:
            transaction.order?.item_type === OrderItemType.EVENT_TICKET
              ? 'Event Booking'
              : 'Course Enrollment',
          paymentPlan:
            metadata?.payment_type === 'MONTHLY'
              ? 'Monthly Instalment'
              : 'One Time',
          source:
            transaction.gateway === PaymentGateway.MANUAL
              ? 'Manual Entry'
              : 'Stripe',
          invoiceFile: transaction.receipt_url || undefined,
          order: transaction.order
            ? {
                id: transaction.order.id,
                orderNumber: transaction.order.order_number,
                itemType: transaction.order.item_type,
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
        total_pages: Math.ceil(total / limit),
        search: normalizedSearch,
        payment_type,
        status,
        date,
      },
    };
  }

  addManualPayment(body: any) {
    return this.financeService.addManualPayment(body);
  }

  suspendOverdueInstallmentAccess() {
    return this.financeService.suspendOverdueInstallmentAccess();
  }

  getFinanceDashboardData() {
    return this.financeAndPaymentsService.getFinanceDashboardData();
  }
}
