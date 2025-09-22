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

  // Create a subscription checkout session for monthly installments
  @Post('create-subscription')
  async createSubscription(
    @Body()
    body: {
      userId: string;
      enrollmentId: string;
      currency?: string;
      name?: string;
      email?: string;
      customerId?: string;
    },
  ) {
    const { userId, enrollmentId, currency, name, email, customerId } = body;
    // Validate enrollment ownership
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment || enrollment.user_id !== userId) {
      return { success: false, message: 'Invalid enrollment' };
    }

    const session = await this.stripeService.createEnrollmentSubscriptionCheckout({
      userId,
      enrollmentId,
      currency,
      name,
      email,
      customerId,
    });

    return { success: true, data: session };
  }
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

  // Handle events (payment intents + subscription lifecycle)
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
        case 'invoice.payment_succeeded': {
          // Subscription recurring charge success; mark UserPayment entry as PAID for that cycle
          const invoice: any = event.data.object;
          const subscriptionId = invoice.subscription;
          const metadata = invoice.lines?.data?.[0]?.metadata || invoice.metadata || {};
          const enrollmentId = metadata.enrollmentId;
          const userId = metadata.userId;
          const amount = invoice.amount_paid ? invoice.amount_paid / 100 : undefined;
          const currency = invoice.currency?.toUpperCase();

          if (enrollmentId && userId) {
            await this.prisma.userPayment.update({
              where: { enrollmentId },
              data: {
                payment_status: 'PAID',
                payment_date: new Date(),
                transaction_id: subscriptionId,
              },
            });

            const up = await this.prisma.userPayment.findUnique({
              where: { enrollmentId },
              select: { id: true },
            });
            if (up) {
              await this.prisma.paymentHistory.create({
                data: {
                  user_id: userId,
                  userPaymentId: up.id,
                  amount,
                  currency,
                  payment_status: 'PAID',
                  payment_type: 'MONTHLY' as any,
                  transaction_id: subscriptionId,
                  description: 'Subscription invoice paid',
                },
              });
            }
          }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub: any = event.data.object;
          const metadata = sub.metadata || {};
          const enrollmentId = metadata.enrollmentId;
          const userId = metadata.userId;
          if (!enrollmentId || !userId) break;
          // Reflect status changes; do not mark paid here (we do that on invoice)
          await this.prisma.userPayment.update({
            where: { enrollmentId },
            data: {
              transaction_id: sub.id,
            },
          });
          break;
        }
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
