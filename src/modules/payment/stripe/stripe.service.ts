import { Injectable } from '@nestjs/common';
import { StripePayment } from '../../../common/lib/Payment/stripe/StripePayment';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class StripeService {
  constructor(private prisma: PrismaService) {}

  async createEnrollmentPaymentIntent(params: {
    userId: string;
    enrollmentId: string;
    amount: number;
    currency: string;
    payment_type: 'ONE_TIME' | 'MONTHLY';
    name?: string;
    email?: string;
    customerId?: string;
  }) {
    const { userId, enrollmentId, amount, currency, payment_type } = params;

    // Ensure the user has a Stripe customer
    let customerId = params.customerId || null;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Try to reuse an existing billing_id (customerId)
    if (!customerId && user?.billing_id) {
      customerId = user.billing_id;
    }

    if (!customerId) {
      const customer = await StripePayment.createCustomer({
        user_id: userId,
        name: params.name || user?.name || 'Customer',
        email: params.email || user?.email || '',
      });
      customerId = customer.id;
      // persist to user for reuse
      await this.prisma.user.update({
        where: { id: userId },
        data: { billing_id: customerId },
      });
    }

    // Create a PaymentIntent for one-time payments.
    // For monthly installments, you may prefer Stripe Subscriptions; here we still create a PI per billing cycle kickoff.
    const paymentIntent = await StripePayment.createPaymentIntent({
      amount,
      currency,
      customer_id: customerId,
      metadata: {
        enrollmentId,
        userId,
        payment_type,
      },
    });

    return {
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      customer_id: customerId,
    };
  }

  async eventPaymentHistory(params: {
    userId: string;
    eventId: string;
    amount: number;
    currency: string;
    name?: string;
    email?: string;
    customerId?: string;
  }) {
    const { userId, eventId, amount, currency } = params;
  }

  async handleWebhook(rawBody: string, sig: string | string[]) {
    return StripePayment.handleWebhook(rawBody, sig);
  }

  async createEnrollmentSubscriptionCheckout(params: {
    userId: string;
    enrollmentId: string;
    currency?: string;
    name?: string;
    email?: string;
    customerId?: string;
  }) {
    const { userId, enrollmentId, currency = 'usd' } = params;

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });
    if (!enrollment || enrollment.user_id !== userId) {
      throw new Error('Invalid enrollment');
    }

    // Ensure the user has a Stripe customer
    let customerId = params.customerId || null;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!customerId && user?.billing_id) customerId = user.billing_id;
    if (!customerId) {
      const customer = await StripePayment.createCustomer({
        user_id: userId,
        name: params.name || user?.name || 'Customer',
        email: params.email || user?.email || '',
      });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { billing_id: customerId },
      });
    }

    // Determine monthly amount
    let amount = Number(enrollment.course?.fee ?? 0);
    const ip = enrollment.course?.installment_process as any;
    if (ip && typeof ip === 'object' && ip.monthly_amount) {
      amount = Number(ip.monthly_amount);
    }
    if (!amount) {
      throw new Error(
        'Installment configuration missing. Set monthly_amount in course.installment_process.',
      );
    }

    // Create a recurring price on-the-fly (or reuse if you store price ids per course)
    const price = await StripePayment.createRecurringPrice({
      amount,
      currency,
      productName: `Course installment for ${enrollment.course?.title ?? 'Course'}`,
      interval: 'month',
    });

    // Create checkout session for subscription
    const session = await StripePayment.createCheckoutSessionSubscription(
      customerId!,
      price.id,
      {
        metadata: { userId, enrollmentId, flow: 'ENROLLMENT_MONTHLY' },
        subscription_metadata: { userId, enrollmentId, flow: 'ENROLLMENT_MONTHLY' },
      },
    );

    // Upsert pending UserPayment
    await this.prisma.userPayment.upsert({
      where: { enrollmentId },
      create: {
        enrollmentId,
        user_id: userId,
        payment_type: 'MONTHLY' as any,
        payment_status: 'DUE',
        amount,
        currency: currency.toUpperCase(),
      },
      update: {
        payment_type: 'MONTHLY' as any,
        amount,
        currency: currency.toUpperCase(),
      },
    });

    return { url: session.url, id: session.id };
  }
}
