import { BadRequestException, Injectable } from '@nestjs/common';
import { StripePayment } from '../../../common/lib/Payment/stripe/StripePayment';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCheckoutDto } from './dto/create-stripe.dto';
import {
  EnrollmentStep,
  EnrollmentStatus,
  OrderItemType,
  PaymentMode,
} from '@prisma/client';
import appConfig from '../../../config/app.config';

@Injectable()
export class StripeService {
  constructor(private prisma: PrismaService) {}

  // ─── PUBLIC: Create Checkout Session ────────────────────────────────
  async createCheckout(userId: string, body: CreateCheckoutDto) {
    const {
      enrollment_id: enrollmentId,
      event_id: eventId,
      currency = 'usd',
    } = body;

    if (!enrollmentId && !eventId) {
      throw new BadRequestException('enrollment_id or event_id is required');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const customerId = await this.getOrCreateCustomer(
      userId,
      user.name,
      user.email,
      user.customer_id,
    );

    if (eventId)
      return this.createEventCheckout(userId, eventId, currency, customerId);
    return this.createCourseCheckout(
      userId,
      enrollmentId!,
      currency,
      customerId,
    );
  }

  // ─── Course Full Payment ───────────────────────────────────────────
  private async createCourseCheckout(
    userId: string,
    enrollmentId: string,
    currency: string,
    customerId: string,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });

    if (!enrollment || enrollment.user_id !== userId) {
      throw new BadRequestException('Invalid enrollment');
    }
    if (
      enrollment.status === EnrollmentStatus.ACTIVE &&
      enrollment.step === EnrollmentStep.COMPLETED
    ) {
      throw new BadRequestException('Already enrolled in this course');
    }
    if (!enrollment.course_id) {
      throw new BadRequestException('Enrollment has no course assigned');
    }

    const amount = Number(enrollment.course?.fee_pence ?? 0);
    if (amount <= 0) throw new BadRequestException('Course has no fee');

    // Check for existing pending order to resume
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        user_id: userId,
        course_id: enrollment.course_id,
        payment_mode: PaymentMode.FULL,
        status: 'PENDING',
      },
      include: {
        transactions: {
          where: { status: 'PENDING' },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (existingOrder && existingOrder.transactions.length > 0) {
      const tx = existingOrder.transactions[0];
      if (tx.stripe_checkout_session_id) {
        try {
          const session = await StripePayment.retrieveCheckoutSession(
            tx.stripe_checkout_session_id,
          );
          if (session && session.status === 'open' && session.url) {
            return { success: true, data: { session_url: session.url } };
          } else {
            // session is expired or complete, mark tx as failed so we can create a new one
            await this.prisma.paymentTransaction.update({
              where: { id: tx.id },
              data: { status: 'FAILED' },
            });
          }
        } catch (e) {
          // ignore error and proceed to create new
        }
      }
    }

    return this.createSessionAndOrder({
      userId,
      customerId,
      amount,
      currency,
      itemType: OrderItemType.COURSE_ENROLLMENT,
      productName: enrollment.course?.title ?? 'Course Enrollment',
      courseId: enrollment.course_id,
      metadata: { enrollmentId, userId, flow: 'COURSE_FULL' },
      existingOrderId: existingOrder?.id,
    });
  }

  // ─── Event Full Payment ────────────────────────────────────────────
  private async createEventCheckout(
    userId: string,
    eventId: string,
    currency: string,
    customerId: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event || !event.amount_pence) {
      throw new BadRequestException('Invalid event or no ticket price');
    }

    // Check if already registered
    const existingRegistration = await this.prisma.eventRegistration.findFirst({
      where: { user_id: userId, event_id: eventId },
    });
    if (existingRegistration)
      throw new BadRequestException('Already registered for this event');

    // Check for existing pending order to resume
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        user_id: userId,
        event_id: eventId,
        item_type: OrderItemType.EVENT_TICKET,
        payment_mode: PaymentMode.FULL,
        status: 'PENDING',
      },
      include: {
        transactions: {
          where: { status: 'PENDING' },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (existingOrder && existingOrder.transactions.length > 0) {
      const tx = existingOrder.transactions[0];
      if (tx.stripe_checkout_session_id) {
        try {
          const session = await StripePayment.retrieveCheckoutSession(
            tx.stripe_checkout_session_id,
          );
          if (session && session.status === 'open' && session.url) {
            return { success: true, data: { session_url: session.url } };
          } else {
            await this.prisma.paymentTransaction.update({
              where: { id: tx.id },
              data: { status: 'FAILED' },
            });
          }
        } catch (e) {
          // ignore
        }
      }
    }

    return this.createSessionAndOrder({
      userId,
      customerId,
      amount: Number(event.amount_pence),
      currency,
      itemType: OrderItemType.EVENT_TICKET,
      productName: event.name,
      eventId,
      metadata: { eventId, userId, flow: 'EVENT_FULL' },
      existingOrderId: existingOrder?.id,
    });
  }

  // ─── Unified: Create Order + Transaction + Stripe Session ──────────
  private async createSessionAndOrder(params: {
    userId: string;
    customerId: string;
    amount: number;
    currency: string;
    itemType: OrderItemType;
    productName: string;
    courseId?: string;
    eventId?: string;
    metadata: Record<string, string>;
    existingOrderId?: string;
  }) {
    const {
      userId,
      customerId,
      amount,
      currency,
      itemType,
      productName,
      existingOrderId,
    } = params;
    const clientUrl = appConfig().app.client_app_url || appConfig().app.url;

    const session = await StripePayment.createCheckoutSessionPayment({
      customer: customerId,
      amount, // fee_pence / amount_pence is already in smallest unit
      currency,
      productName,
      metadata: params.metadata,
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel`,
    });

    let orderId = existingOrderId;

    if (!orderId) {
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const order = await this.prisma.order.create({
        data: {
          order_number: orderNumber,
          user_id: userId,
          item_type: itemType,
          payment_mode: PaymentMode.FULL,
          subtotal_amount: amount,
          total_amount: amount,
          due_amount: amount,
          currency: currency.toUpperCase(),
          status: 'PENDING',
          course_id: params.courseId,
          event_id: params.eventId,
        },
      });
      orderId = order.id;
    }

    await this.prisma.paymentTransaction.create({
      data: {
        transaction_ref: session.id,
        order_id: orderId,
        user_id: userId,
        amount,
        currency: currency.toUpperCase(),
        status: 'PENDING',
        gateway: 'STRIPE',
        payment_method: 'card',
        stripe_checkout_session_id: session.id,
        metadata: params.metadata,
      },
    });

    return { success: true, data: { session_url: session.url } };
  }

  // ─── Webhook: Checkout Session Completed ───────────────────────────
  async handleCheckoutCompleted(session: any) {
    const metadata = session.metadata || {};
    const userId = metadata.userId;
    const flow = metadata.flow;

    if (!userId) return;

    // Update transaction
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { stripe_checkout_session_id: session.id },
    });

    if (!transaction) return;

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'SUCCESS',
        paid_at: new Date(),
        stripe_payment_intent_id: session.payment_intent ?? undefined,
      },
    });

    // Update order
    if (transaction.order_id) {
      await this.prisma.order.update({
        where: { id: transaction.order_id },
        data: {
          status: 'PAID',
          paid_amount: transaction.amount,
          due_amount: 0,
        },
      });
    }

    // Course enrollment activation
    if (flow === 'COURSE_FULL' && metadata.enrollmentId) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { id: metadata.enrollmentId },
      });
      if (enrollment) {
        await this.prisma.enrollment.update({
          where: { id: metadata.enrollmentId },
          data: {
            status: EnrollmentStatus.ACTIVE,
            step: EnrollmentStep.COMPLETED,
            ...(enrollment.order_id ? {} : { order_id: transaction.order_id }),
          },
        });
      }
    }

    // Event registration
    if (flow === 'EVENT_FULL' && metadata.eventId) {
      const exists = await this.prisma.eventRegistration.findFirst({
        where: { user_id: userId, event_id: metadata.eventId },
      });
      if (!exists) {
        const ticket = `TKT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        await this.prisma.eventRegistration.create({
          data: {
            user: { connect: { id: userId } },
            event: { connect: { id: metadata.eventId } },
            order: { connect: { id: transaction.order_id } },
            ticket_number: ticket,
            status: 'CONFIRMED',
          },
        });
      }
    }
  }

  // ─── Webhook: Session Expired ──────────────────────────────────────
  async handleCheckoutExpired(session: any) {
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { stripe_checkout_session_id: session.id },
    });

    if (transaction) {
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      if (transaction.order_id) {
        await this.prisma.order.update({
          where: { id: transaction.order_id },
          data: { status: 'CANCELLED' },
        });
      }
    }
  }

  // ─── Webhook Entry ─────────────────────────────────────────────────
  async handleWebhook(rawBody: string, sig: string | string[]) {
    return StripePayment.handleWebhook(rawBody, sig);
  }

  // ─── Verify Payment ────────────────────────────────────────────────
  async verifyPayment(sessionId: string, userId: string) {
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { stripe_checkout_session_id: sessionId },
      include: {
        order: { include: { course: true, event: true } },
      },
    });

    if (!transaction)
      return { success: false, message: 'Transaction not found' };
    if (transaction.user_id !== userId)
      return { success: false, message: 'Unauthorized' };

    return {
      success: true,
      data: {
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        paid_at: transaction.paid_at,
        order: transaction.order
          ? {
              status: transaction.order.status,
              item_type: transaction.order.item_type,
              order_number: transaction.order.order_number,
              course: transaction.order.course?.title,
              event: transaction.order.event?.name,
            }
          : null,
      },
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────
  private async getOrCreateCustomer(
    userId: string,
    name?: string,
    email?: string,
    existingCustomerId?: string,
  ) {
    if (existingCustomerId) return existingCustomerId;

    const customer = await StripePayment.createCustomer({
      user_id: userId,
      name: name || 'Customer',
      email: email || '',
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { customer_id: customer.id },
    });

    return customer.id;
  }
}
