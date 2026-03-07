import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { createPaymentIntent } from './dto/create-stripe.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';

@Controller('payment/stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('create-intent')
  async createIntent(@Req() req: Request, @Body() body: createPaymentIntent) {
    if (!req.user.userId) {
      throw new BadRequestException('Unauthorized');
    }
    const result = await this.stripeService.handleCreateIntent(
      req.user.userId,
      body,
    );
    return result;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('create-subscription')
  async createSubscription(
    @Req() req: Request,
    @Body() body: createPaymentIntent,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException('Unauthorized');
    }
    const result = await this.stripeService.handleCreateIntent(
      req.user.userId,
      {
        ...body,
        payment_type: 'MONTHLY',
      },
    );
    return result;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('verify/:reference')
  async verifyPayment(@Req() req: Request) {
    const reference = req.params.reference;
    if (!req.user.userId) {
      throw new BadRequestException('Unauthorized');
    }
    return await this.stripeService.verifyPaymentByReference(
      reference,
      req.user.userId,
    );
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ) {
    try {
      const payload = req.rawBody.toString();
      const event = await this.stripeService.handleWebhook(payload, signature);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.stripeService.handlePaymentIntentSucceeded(
            event.data.object,
          );
          break;
        case 'payment_intent.payment_failed':
          await this.stripeService.handlePaymentIntentFailed(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.stripeService.handleInvoicePaymentSucceeded(
            event.data.object,
          );
          break;
        case 'invoice.payment_failed':
          await this.stripeService.handleInvoicePaymentFailed(
            event.data.object,
          );
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.stripeService.handleSubscriptionEvents(event.data.object);
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
