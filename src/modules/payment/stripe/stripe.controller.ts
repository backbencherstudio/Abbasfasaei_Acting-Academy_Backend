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

    const session =
      await this.stripeService.createEnrollmentSubscriptionCheckout({
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

    console.log('body', body);

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
        email: enrollment.email,
        customerId: body.customerId,
      });

    // Create new Order, OrderItem, and Transaction
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const order = await this.prisma.order.create({
      data: {
        order_number: orderNumber,
        user_id: userId,
        total_amount: amount,
        currency: currency.toUpperCase(),
        status: 'PENDING',
        notes: `Enrollment ID: ${enrollmentId}`,
        items: {
          create: {
            item_type: 'COURSE_ENROLLMENT',
            course_id: enrollment.courseId,
            unit_price: amount,
            quantity: 1,
            total_price: amount,
          },
        },
      },
    });

    await this.prisma.transaction.create({
      data: {
        transaction_ref: payment_intent_id,
        order_id: order.id,
        user_id: userId,
        amount,
        currency: currency.toUpperCase(),
        status: 'PENDING',
        gateway: 'STRIPE',
        payment_method: payment_type,
        metadata: { enrollmentId, payment_type, customer_id },
      },
    });

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
          const latestCharge = paymentIntent.charges?.data?.[0];
          const pm = latestCharge?.payment_method_details;
          const card = pm?.card || pm?.card_present || undefined;
          const card_brand = card?.brand || card?.network;
          const card_last4 = card?.last4;
          const card_exp_month = card?.exp_month;
          const card_exp_year = card?.exp_year;

          if (enrollmentId && userId) {
            // Update the Transaction status to SUCCESS
            const updatedTransaction = await this.prisma.transaction.update({
              where: { transaction_ref: paymentIntent.id },
              data: {
                status: 'SUCCESS',
                payment_date: new Date(),
                card_last4,
                metadata: {
                  ...(typeof paymentIntent.metadata === 'object'
                    ? paymentIntent.metadata
                    : {}),
                  customer_id: paymentIntent.customer ?? undefined,
                  payment_method_id: paymentIntent.payment_method ?? undefined,
                  card_brand,
                  card_exp_month,
                  card_exp_year,
                },
              },
            });

            // Update the Order status to COMPLETED
            if (updatedTransaction) {
              await this.prisma.order.update({
                where: { id: updatedTransaction.order_id },
                data: {
                  status: 'COMPLETED',
                },
              });
            }

            // Update Enrollment status
            await this.prisma.enrollment.update({
              where: { id: enrollmentId },
              data: {
                IsPaymentCompleted: true,
                status: 'ACTIVE',
              },
            });
          }
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
          const metadata =
            invoice.lines?.data?.[0]?.metadata || invoice.metadata || {};
          const enrollmentId = metadata.enrollmentId;
          const userId = metadata.userId;
          const amount = invoice.amount_paid
            ? invoice.amount_paid / 100
            : undefined;
          const currency = invoice.currency?.toUpperCase();
          const payment_intent = invoice.payment_intent; // id only

          if (enrollmentId && userId) {
            // Find an existing order for this enrollment or create one
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const order = await this.prisma.order.create({
              data: {
                order_number: orderNumber,
                user_id: userId,
                total_amount: amount || 0,
                currency: currency || 'USD',
                status: 'COMPLETED',
                notes: `Subscription payment for Enrollment ID: ${enrollmentId}`,
              },
            });

            await this.prisma.transaction.create({
              data: {
                transaction_ref:
                  payment_intent || subscriptionId || `inv_${Date.now()}`,
                order_id: order.id,
                user_id: userId,
                amount: amount || 0,
                currency: currency || 'USD',
                status: 'SUCCESS',
                gateway: 'STRIPE',
                receipt_url: invoice.hosted_invoice_url ?? undefined,
                payment_date: new Date(),
                metadata: {
                  enrollmentId,
                  subscriptionId,
                  customer_id: invoice.customer ?? undefined,
                  payment_method_id: invoice.payment_method ?? undefined,
                },
              },
            });

            await this.prisma.enrollment.update({
              where: { id: enrollmentId },
              data: {
                IsPaymentCompleted: true,
                status: 'ACTIVE',
              },
            });
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
          // Since we use Transaction models, we will log this in metadata of a transaction if needed or just skip.
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
