import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Headers,
  BadRequestException,
  UseGuards,
  Param,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { CreateCheckoutDto } from './dto/create-stripe.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@Controller('payment/stripe')
@DisAllowDeactivated()
export class StripeController {
  constructor(private readonly stripeService: StripeService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('checkout')
  async createCheckout(@Req() req: Request, @Body() body: CreateCheckoutDto) {
    if (!req.user.userId) throw new BadRequestException('Unauthorized');
    return this.stripeService.createCheckout(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('verify/:session_id')
  async verifyPayment(
    @Req() req: Request,
    @Param('session_id') session_id: string,
  ) {
    if (!req.user.userId) throw new BadRequestException('Unauthorized');
    return this.stripeService.verifyPayment(session_id, req.user.userId);
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ) {
    try {
      const event = await this.stripeService.handleWebhook(
        req.rawBody.toString(),
        signature,
      );

      switch (event.type) {
        case 'checkout.session.completed':
          await this.stripeService.handleCheckoutCompleted(event.data.object);
          break;
        case 'checkout.session.expired':
          await this.stripeService.handleCheckoutExpired(event.data.object);
          break;
        default:
          console.log(`Unhandled event: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error:', error.message);
      return { received: false };
    }
  }
}
