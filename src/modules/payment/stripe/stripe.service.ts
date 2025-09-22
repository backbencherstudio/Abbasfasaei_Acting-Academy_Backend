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

  async handleWebhook(rawBody: string, sig: string | string[]) {
    return StripePayment.handleWebhook(rawBody, sig);
  }
}
