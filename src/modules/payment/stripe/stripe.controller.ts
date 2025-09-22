import { Body, Controller, Post, Req, Headers } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('payment/stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  // Create a payment intent for enrollment: one-time or monthly
  @Post('create-intent')
  async createIntent(
    @Body()
    body: {
      userId: string;
      enrollmentId: string;
      amount?: number; // ignored if course provides pricing
      currency?: string;
      payment_type: 'ONE_TIME' | 'MONTHLY';
      customerId?: string; // optional pre-created customer
      name?: string;
      email?: string;
    },
  ) {
    const { userId, enrollmentId, currency = 'usd', payment_type } = body;
    // Ensure enrollment belongs to user and get course pricing
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });
    if (!enrollment || enrollment.user_id !== userId) {
      return { success: false, message: 'Invalid enrollment' };
    }

    // Compute amount from course fee and optional installment config (server-authoritative)
    let amount = Number(enrollment.course?.fee ?? 0);
    if (payment_type === 'MONTHLY') {
      const ip = enrollment.course?.installment_process as any;
      if (ip && typeof ip === 'object' && ip.monthly_amount) {
        amount = Number(ip.monthly_amount);
      } else if (!amount) {
        return {
          success: false,
          message:
            'Installment configuration missing. Please set monthly_amount in course.installment_process.',
        };
      }
    }

    const { client_secret, payment_intent_id, customer_id } =
      await this.stripeService.createEnrollmentPaymentIntent({
        userId,
        amount,
        currency,
        enrollmentId,
        payment_type,
        name: body.name,
        email: body.email,
        customerId: body.customerId,
      });

    // Upsert UserPayment record as DUE with reference to PI
    await this.prisma.userPayment.upsert({
      where: { enrollmentId },
      create: {
        enrollmentId,
        user_id: userId,
        payment_type: payment_type as any,
        payment_status: 'DUE',
        amount,
        currency: currency.toUpperCase(),
        transaction_id: payment_intent_id,
      },
      update: {
        payment_type: payment_type as any,
        amount,
        currency: currency.toUpperCase(),
        transaction_id: payment_intent_id,
      },
    });

    // Create initial PaymentHistory entry
    const userPayment = await this.prisma.userPayment.findUnique({
      where: { enrollmentId },
      select: { id: true },
    });
    if (userPayment) {
      await this.prisma.paymentHistory.create({
        data: {
          user_id: userId,
          userPaymentId: userPayment.id,
          amount,
          currency: currency.toUpperCase(),
          payment_status: 'DUE',
          payment_type: payment_type as any,
          transaction_id: payment_intent_id,
          description: 'Enrollment payment initiated',
        },
      });
    }

    // Transaction record persisted via UserPayment + PaymentHistory; no legacy transaction table used.

    return {
      success: true,
      data: { client_secret, payment_intent_id, customer_id },
    };
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ) {
    try {
      const payload = req.rawBody.toString();
      const event = await this.stripeService.handleWebhook(payload, signature);

      // Handle events
      switch (event.type) {
        case 'customer.created':
          break;
        case 'payment_intent.created':
          break;
        case 'payment_intent.succeeded': {
          const paymentIntent: any = event.data.object;
          const enrollmentId = paymentIntent.metadata?.enrollmentId;
          const userId = paymentIntent.metadata?.userId;
          const amount = paymentIntent.amount / 100;
          const currency = paymentIntent.currency.toUpperCase();

          if (enrollmentId && userId) {
            // Update UserPayment and Enrollment
            await this.prisma.userPayment.update({
              where: { enrollmentId },
              data: {
                payment_status: 'PAID',
                payment_date: new Date(),
              },
            });

            await this.prisma.enrollment.update({
              where: { id: enrollmentId },
              data: {
                payment_status: 'PAID',
                status: 'ACTIVE',
              },
            });

            const userPayment = await this.prisma.userPayment.findUnique({
              where: { enrollmentId },
              select: { id: true },
            });
            if (userPayment) {
              await this.prisma.paymentHistory.create({
                data: {
                  user_id: userId,
                  userPaymentId: userPayment.id,
                  amount,
                  currency,
                  payment_status: 'PAID',
                  payment_type: undefined,
                  transaction_id: paymentIntent.id,
                  description: 'Enrollment payment captured',
                },
              });
            }
          }

          // No legacy transaction table: persisted via PaymentHistory
          break;
        }
        case 'payment_intent.payment_failed':
          const failedPaymentIntent = event.data.object;
          // No legacy transaction table: optionally log or create PaymentHistory with failure status
        case 'payment_intent.canceled':
          const canceledPaymentIntent = event.data.object;
          // No legacy transaction table
          break;
        case 'payment_intent.requires_action':
          const requireActionPaymentIntent = event.data.object;
          // No legacy transaction table
          break;
        case 'payout.paid':
          const paidPayout = event.data.object;
          console.log(paidPayout);
          break;
        case 'payout.failed':
          const failedPayout = event.data.object;
          console.log(failedPayout);
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error', error);
      return { received: false };
    }
  }
}
