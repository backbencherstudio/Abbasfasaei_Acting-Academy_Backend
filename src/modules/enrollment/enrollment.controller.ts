import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { EnrollDto } from './dto/enroll.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

@Controller('enrollment')
@UseGuards(JwtAuthGuard) // Protect routes with JWT authentication
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  // Enroll user
  @Post('enroll')
  async enrollUser(@GetUser() user, @Body() dto: EnrollDto) {
    console.log('user', user);
    try {
      const result = await this.enrollmentService.enrollUser(user.userId, dto);
      return result; // Returns the success response from the service
    } catch (error) {
      console.error(error); // Log the detailed error
      throw new InternalServerErrorException('Error enrolling user'); // Provide a more specific error response
    }
  }

  // Accept rules and regulations
  @Post('rules-regulations')
  async acceptRulesAndRegulations(
    @GetUser() user,
    @Body()
    dto: {
      agreed: boolean;
      signature_full_name: string;
      signature: string;
      signature_date: string; // ISO string
    },
  ) {
    try {
      const result = await this.enrollmentService.acceptRulesAndRegulations(
        user.userId,
        dto.agreed,
        dto.signature_full_name,
        dto.signature,
        dto.signature_date,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Error accepting rules and regulations');
    }
  }

  // Accept contract terms
  @Post('contract-terms')
  async acceptContractTerms(
    @GetUser() user,
    @Body() dto: { accepted: boolean },
  ) {
    try {
      const result = await this.enrollmentService.acceptContractTerms(
        user.userId,
        dto.accepted,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Error accepting contract terms');
    }
  }

  // Process payment
  // @Post('payment')
  // async processPayment(
  //   @GetUser() user,
  //   @Body() dto: { amount: number; paymentMethod: string },
  // ) {
  //   try {
  //     const result = await this.enrollmentService.processPayment(
  //       user.userId,
  //       dto.amount,
  //       dto.paymentMethod,
  //     );
  //     return result;
  //   } catch (error) {
  //     console.error(error);
  //     throw new InternalServerErrorException('Error processing payment');
  //   }
  // }


}
