import { Injectable } from '@nestjs/common';
import { StripePayment } from '../../../common/lib/Payment/stripe/StripePayment';
import { PrismaService } from '../../../prisma/prisma.service';
import { createPaymentIntent } from './dto/create-stripe.dto';

@Injectable()
export class StripeService {
  constructor(private prisma: PrismaService) {}

  async handleCreateIntent(userId: string, body: createPaymentIntent) {
    const { enrollmentId, eventId, currency = 'usd', payment_type } = body;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // EVENT Payment
    if (eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
      });
      if (!event || !event.amount) {
        return {
          success: false,
          message: 'Invalid event or no ticket price available',
        };
      }

      const data = await this.createOneTimeEventPaymentIntent({
        userId,
        eventId,
        amount: Number(event.amount),
        currency,
        name: user.name,
        email: user.email,
        customerId: user.customer_id,
      });
      return { success: true, data };
    }

    // ENROLLMENT Payment
    if (enrollmentId) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        include: { course: true },
      });
      if (!enrollment || enrollment.user_id !== userId) {
        return { success: false, message: 'Invalid enrollment' };
      }

      let amount = Number(enrollment.course?.fee ?? 0);

      if (payment_type === 'ONE_TIME') {
        const data = await this.createOneTimeEnrollmentPaymentIntent({
          userId,
          enrollmentId,
          amount,
          currency,
          name: user.name,
          email: user.email,
          customerId: user.customer_id,
        });
        return { success: true, data };
      }

      if (payment_type === 'MONTHLY') {
        const ip = enrollment.course?.installment_process as any;
        if (ip && typeof ip === 'object' && ip.monthly_amount) {
          amount = Number(ip.monthly_amount);
        } else {
          return {
            success: false,
            message: 'Installment configuration missing.',
          };
        }

        const data = await this.createMonthlyEnrollmentSubscription({
          userId,
          enrollmentId,
          amount,
          currency,
          name: user.name,
          email: user.email,
          customerId: user.customer_id,
        });
        return { success: true, data };
      }
    }

    return { success: false, message: 'Invalid request parameters' };
  }

  private async getOrCreateCustomer(
    userId: string,
    name?: string,
    email?: string,
    existingCustomerId?: string,
  ) {
    if (existingCustomerId) return existingCustomerId;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.customer_id) return user.customer_id;

    const customer = await StripePayment.createCustomer({
      user_id: userId,
      name: name || user?.name || 'Customer',
      email: email || user?.email || '',
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { customer_id: customer.id },
    });

    return customer.id;
  }

  async createOneTimeEnrollmentPaymentIntent(params: {
    userId: string;
    enrollmentId: string;
    amount: number;
    currency: string;
    name?: string;
    email?: string;
    customerId?: string;
  }) {
    const { userId, enrollmentId, amount, currency } = params;

    // Check for existing pending transaction to resume
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        user_id: userId,
        course_id: enrollmentId,
        payment_type: 'ONE_TIME',
        status: 'PENDING',
      },
      include: {
        transactions: {
          where: { status: 'PENDING' },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (existingPayment && existingPayment.transactions.length > 0) {
      const pendingTx = existingPayment.transactions[0];
      const metadata = pendingTx.metadata as any;
      if (Number(pendingTx.amount) === amount && metadata?.client_secret) {
        return {
          client_secret: metadata.client_secret,
          payment_intent_id: pendingTx.transaction_ref,
          customer_id: metadata.customer_id,
        };
      }
    }

    const customerId = await this.getOrCreateCustomer(
      userId,
      params.name,
      params.email,
      params.customerId,
    );

    const paymentIntent = await StripePayment.createPaymentIntent({
      amount,
      currency,
      customer_id: customerId,
      metadata: { enrollmentId, userId, payment_type: 'ONE_TIME' },
    });

    let payment: any = existingPayment;
    if (!payment) {
      const orderNumber = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      payment = await this.prisma.payment.create({
        data: {
          order_number: orderNumber,
          user_id: userId,
          total_amount: amount,
          due_amount: amount,
          currency: currency.toUpperCase(),
          status: 'PENDING',
          item_type: 'COURSE_ENROLLMENT',
          payment_type: 'ONE_TIME',
          notes: `One-Time Enrollment ID: ${enrollmentId}`,
          course_id: enrollmentId,
        },
      });
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { total_amount: amount, due_amount: amount },
      });
    }

    await this.prisma.transaction.create({
      data: {
        transaction_ref: paymentIntent.id,
        paymentId: payment.id,
        user_id: userId,
        amount,
        currency: currency.toUpperCase(),
        status: 'PENDING',
        gateway: 'STRIPE',
        payment_method: 'ONE_TIME',
        metadata: {
          enrollmentId,
          payment_type: 'ONE_TIME',
          customer_id: customerId,
          client_secret: paymentIntent.client_secret,
        },
      },
    });

    return {
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      customer_id: customerId,
    };
  }

  async createMonthlyEnrollmentSubscription(params: {
    userId: string;
    enrollmentId: string;
    amount: number;
    currency: string;
    name?: string;
    email?: string;
    customerId?: string;
  }) {
    const { userId, enrollmentId, amount, currency } = params;

    // Check for existing pending subscription checkout session
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        user_id: userId,
        course_id: enrollmentId,
        payment_type: 'MONTHLY',
        status: 'PENDING',
      },
      include: {
        transactions: {
          where: { status: 'PENDING' },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (existingPayment && existingPayment.transactions.length > 0) {
      const pendingTx = existingPayment.transactions[0];
      const metadata = pendingTx.metadata as any;
      if (Number(pendingTx.amount) === amount && metadata?.client_secret) {
        return {
          client_secret: metadata.client_secret,
          subscription_id: pendingTx.transaction_ref,
          customer_id: metadata.customer_id,
        };
      }
    }

    const customerId = await this.getOrCreateCustomer(
      userId,
      params.name,
      params.email,
      params.customerId,
    );

    // Fetch course for title
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });

    const price = await StripePayment.createRecurringPrice({
      amount,
      currency,
      productName: `Course installment for ${enrollment?.course?.title ?? 'Course'}`,
      interval: 'month',
    });

    const subscription = await StripePayment.createSubscription(
      customerId,
      price.id,
      {
        metadata: {
          userId,
          enrollmentId,
          flow: 'ENROLLMENT_MONTHLY',
        },
      },
    );

    const latestInvoice = subscription.latest_invoice as any;
    const paymentIntent = latestInvoice?.payment_intent;
    const clientSecret = paymentIntent?.client_secret;

    if (!clientSecret) {
      throw new Error('Failed to generate payment intent for subscription');
    }

    let payment: any = existingPayment;
    if (!payment) {
      const courseFee = Number(enrollment?.course?.fee ?? 0);
      const orderNumber = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      payment = await this.prisma.payment.create({
        data: {
          order_number: orderNumber,
          user_id: userId,
          total_amount: courseFee,
          due_amount: courseFee,
          installment_amount: amount,
          currency: currency.toUpperCase(),
          status: 'PENDING',
          item_type: 'COURSE_ENROLLMENT',
          payment_type: 'MONTHLY',
          stripe_subscription_id: subscription.id,
          notes: `Monthly Enrollment ID: ${enrollmentId}`,
          course_id: enrollmentId,
        },
      });
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { stripe_subscription_id: subscription.id },
      });
    }

    await this.prisma.transaction.create({
      data: {
        transaction_ref: subscription.id,
        paymentId: payment.id,
        user_id: userId,
        amount,
        currency: currency.toUpperCase(),
        status: 'PENDING',
        gateway: 'STRIPE',
        payment_method: 'MONTHLY',
        metadata: {
          enrollmentId,
          payment_type: 'MONTHLY',
          customer_id: customerId,
          client_secret: clientSecret,
        },
      },
    });

    return {
      client_secret: clientSecret,
      subscription_id: subscription.id,
      customer_id: customerId,
    };
  }

  async createOneTimeEventPaymentIntent(params: {
    userId: string;
    eventId: string;
    amount: number;
    currency: string;
    name?: string;
    email?: string;
    customerId?: string;
  }) {
    const { userId, eventId, amount, currency } = params;

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        user_id: userId,
        event_id: eventId,
        payment_type: 'ONE_TIME',
        status: 'PENDING',
      },
      include: {
        transactions: {
          where: { status: 'PENDING' },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (existingPayment && existingPayment.transactions.length > 0) {
      const pendingTx = existingPayment.transactions[0];
      const metadata = pendingTx.metadata as any;
      if (Number(pendingTx.amount) === amount && metadata?.client_secret) {
        return {
          client_secret: metadata.client_secret,
          payment_intent_id: pendingTx.transaction_ref,
          customer_id: metadata.customer_id,
        };
      }
    }

    const customerId = await this.getOrCreateCustomer(
      userId,
      params.name,
      params.email,
      params.customerId,
    );

    const paymentIntent = await StripePayment.createPaymentIntent({
      amount,
      currency,
      customer_id: customerId,
      metadata: { eventId, userId, payment_type: 'ONE_TIME' },
    });

    let payment: any = existingPayment;
    if (!payment) {
      const orderNumber = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      payment = await this.prisma.payment.create({
        data: {
          order_number: orderNumber,
          user_id: userId,
          total_amount: amount,
          due_amount: amount,
          currency: currency.toUpperCase(),
          status: 'PENDING',
          item_type: 'EVENT_TICKET',
          payment_type: 'ONE_TIME',
          notes: `Event ID: ${eventId}`,
          event_id: eventId,
        },
      });
    }

    await this.prisma.transaction.create({
      data: {
        transaction_ref: paymentIntent.id,
        paymentId: payment.id,
        user_id: userId,
        amount,
        currency: currency.toUpperCase(),
        status: 'PENDING',
        gateway: 'STRIPE',
        payment_method: 'ONE_TIME',
        metadata: {
          eventId,
          payment_type: 'ONE_TIME',
          customer_id: customerId,
          client_secret: paymentIntent.client_secret,
        },
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

  async handlePaymentIntentSucceeded(paymentIntent: any) {
    const enrollmentId = paymentIntent.metadata?.enrollmentId;
    const eventId = paymentIntent.metadata?.eventId;
    const userId = paymentIntent.metadata?.userId;

    const latestCharge = paymentIntent.charges?.data?.[0];
    const pm = latestCharge?.payment_method_details;
    const card = pm?.card || pm?.card_present || undefined;

    if (!userId) return;

    // Update Transaction
    const updatedTransaction = await this.prisma.transaction.update({
      where: { transaction_ref: paymentIntent.id },
      data: {
        status: 'SUCCESS',
        payment_date: new Date(),
        card_last4: card?.last4,
        metadata: {
          ...(typeof paymentIntent.metadata === 'object'
            ? paymentIntent.metadata
            : {}),
          customer_id: paymentIntent.customer ?? undefined,
          payment_method_id: paymentIntent.payment_method ?? undefined,
          card_brand: card?.brand || card?.network,
          card_exp_month: card?.exp_month,
          card_exp_year: card?.exp_year,
        },
      },
    });

    if (updatedTransaction && updatedTransaction.paymentId) {
      // Find Payment
      const payment = await this.prisma.payment.findUnique({
        where: { id: updatedTransaction.paymentId },
      });

      if (payment) {
        const newPaidAmount =
          Number(payment.paid_amount) + Number(updatedTransaction.amount);
        const newDueAmount = Math.max(
          0,
          Number(payment.total_amount) - newPaidAmount,
        );

        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: newDueAmount <= 0 ? 'COMPLETED' : 'PARTIAL_PAID',
            paid_amount: newPaidAmount,
            due_amount: newDueAmount,
          },
        });
      }
    }

    if (enrollmentId) {
      await this.prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          IsPaymentCompleted: true,
          status: 'ACTIVE',
        },
      });
    }

    if (eventId) {
      // If event ticketing logic is needed
      const existingMember = await this.prisma.eventMember.findFirst({
        where: { user_id: userId, event_id: eventId },
      });
      if (!existingMember) {
        // Generate a 6-digit unique alphanumeric or timestamp ticket number
        const uniqueTicket = `TKT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        await this.prisma.eventMember.create({
          data: {
            user: { connect: { id: userId } },
            event: { connect: { id: eventId } },
            payment: { connect: { id: updatedTransaction.paymentId } },
            ticket_number: uniqueTicket,
          },
        });
      }
    }
  }

  async handlePaymentIntentFailed(paymentIntent: any) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { transaction_ref: paymentIntent.id },
    });

    if (transaction) {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });

      if (transaction.paymentId) {
        await this.prisma.payment.update({
          where: { id: transaction.paymentId },
          data: { status: 'CANCELLED' }, // Cancelling the payment to act as rollback
        });
      }
    }
  }

  async handleInvoicePaymentSucceeded(invoice: any) {
    const subscriptionId = invoice.subscription;
    const metadata =
      invoice.lines?.data?.[0]?.metadata || invoice.metadata || {};
    const enrollmentId = metadata.enrollmentId;
    const userId = metadata.userId;
    const amount = invoice.amount_paid ? invoice.amount_paid / 100 : 0;
    const currency = invoice.currency?.toUpperCase() || 'USD';
    const payment_intent = invoice.payment_intent;

    if (!enrollmentId || !userId) return;

    // Find the master Payment record for this enrollment
    let payment = await this.prisma.payment.findFirst({
      where: {
        user_id: userId,
        course_id: enrollmentId,
        payment_type: 'MONTHLY',
      },
    });

    if (!payment) {
      const orderNumber = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      payment = await this.prisma.payment.create({
        data: {
          order_number: orderNumber,
          user_id: userId,
          total_amount: amount, // will be updated later if course fee is found
          paid_amount: 0,
          due_amount: amount,
          currency: currency,
          status: 'PARTIAL_PAID',
          item_type: 'COURSE_ENROLLMENT',
          payment_type: 'MONTHLY',
          stripe_subscription_id: subscriptionId,
          course_id: enrollmentId,
        },
      });
    } else if (!payment.stripe_subscription_id && subscriptionId) {
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { stripe_subscription_id: subscriptionId },
      });
    }

    // Create a new Transaction for this specific invoice
    await this.prisma.transaction.create({
      data: {
        transaction_ref: payment_intent || invoice.id || `inv_${Date.now()}`,
        paymentId: payment.id,
        user_id: userId,
        amount: amount,
        currency: currency,
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

    // Update payment totals
    const newPaidAmount = Number(payment.paid_amount) + amount;
    let newDueAmount = Math.max(
      0,
      Number(payment.total_amount) - newPaidAmount,
    );

    // Get Course details to verify total fee
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });

    if (enrollment?.course?.fee) {
      const courseFee = Number(enrollment.course.fee);
      newDueAmount = Math.max(0, courseFee - newPaidAmount);

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          total_amount: courseFee,
          paid_amount: newPaidAmount,
          due_amount: newDueAmount,
          status: newDueAmount <= 0 ? 'COMPLETED' : 'PARTIAL_PAID',
        },
      });

      // Cancel subscription if fully paid
      if (newDueAmount <= 0 && subscriptionId) {
        try {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          await stripe.subscriptions.cancel(subscriptionId);
          console.log(
            `Auto-canceled subscription ${subscriptionId} for Enrollment ${enrollmentId} - Course fully paid.`,
          );
        } catch (err) {
          console.error('Failed to auto-cancel Stripe subscription:', err);
        }
      }
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          paid_amount: newPaidAmount,
          due_amount: newDueAmount,
          status: newDueAmount <= 0 ? 'COMPLETED' : 'PARTIAL_PAID',
        },
      });
    }

    await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        IsPaymentCompleted: true,
        status: 'ACTIVE',
      },
    });
  }

  async handleSubscriptionEvents(sub: any) {
    const metadata = sub.metadata || {};
    const enrollmentId = metadata.enrollmentId;
    const userId = metadata.userId;
    if (!enrollmentId || !userId) return;

    // Logic for handling subscription updates/cancellations
    // We could update the 'next_billing_date' on the Payment model here
    if (sub.current_period_end) {
      await this.prisma.payment.updateMany({
        where: { stripe_subscription_id: sub.id },
        data: { next_billing_date: new Date(sub.current_period_end * 1000) },
      });
    }
  }
}
