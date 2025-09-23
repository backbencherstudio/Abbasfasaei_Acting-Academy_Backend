import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Get,
  Param,
} from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { EnrollDto } from './dto/enroll.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

@Controller('enrollment')
@UseGuards(JwtAuthGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @ApiOperation({ summary: 'Get all available courses' })
  @Get('courses')
  async getAllCourses() {
    try {
      const result = await this.enrollmentService.getAllCourses();
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching courses');
    }
  }

  @ApiOperation({ summary: 'Enroll user in a course' })
  @Post('enroll/:courseId')
  async enrollUser(
    @GetUser() user,
    @Param('courseId') courseId: string,
    @Body() dto: EnrollDto,
  ) {
    try {
      const result = await this.enrollmentService.enrollUser(
        user.userId,
        courseId,
        dto,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error enrolling user');
    }
  }

  @ApiOperation({ summary: 'Accept rules and regulations' })
  @Post('rules-and-regulations-signing/:enrollmentId')
  async rulesAndRegulationsSigning(
    @GetUser() user,
    @Param('enrollmentId') enrollmentId: string,
    @Body()
    dto: Partial<{
      agreed: boolean;
      accepted: boolean;
      signature_full_name: string;
      full_name: string;
      signature: string;
      signature_date: string; // ISO string
      signed_at: string; // ISO string
    }>,
  ) {
    try {
      console.log('user:', user);
      const agreed = dto.agreed ?? dto.accepted ?? false;
      const signature_full_name = dto.signature_full_name ?? dto.full_name;
      const signature = dto.signature;
      const signature_date = dto.signature_date ?? dto.signed_at;

      if (!agreed) {
        return { success: true, message: 'Rules and regulations unchanged' };
      }
      if (!signature_full_name || !signature) {
        throw new BadRequestException('Missing signature name or signature');
      }
      if (!signature_date || isNaN(Date.parse(signature_date))) {
        throw new BadRequestException('Invalid signature date');
      }

      const result = await this.enrollmentService.rulesAndRegulationsSigning(
        user.userId,
        enrollmentId,
        agreed,
        signature_full_name,
        signature,
        signature_date,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Error accepting rules and regulations');
    }
  }

  @ApiOperation({ summary: 'Accept contract terms' })
  @Post('digital-contract-signing/:enrollmentId')
  async digitalContractSigning(
    @GetUser() user,
    @Param('enrollmentId') enrollmentId: string,
    @Body()
    dto: Partial<{
      accepted: boolean;
      agreed: boolean;
      signature_full_name: string;
      full_name: string;
      signature: string;
      signature_date: string; // ISO string
      signed_at: string; // ISO string
    }>,
  ) {
    try {
      const accepted = dto.accepted ?? dto.agreed ?? false;
      const signature_full_name = dto.signature_full_name ?? dto.full_name;
      const signature = dto.signature;
      const signature_date = dto.signature_date ?? dto.signed_at;

      if (!accepted) {
        return { success: true, message: 'Contract terms unchanged' };
      }
      if (!signature_full_name || !signature) {
        throw new BadRequestException('Missing signature name or signature');
      }
      if (!signature_date || isNaN(Date.parse(signature_date))) {
        throw new BadRequestException('Invalid signature date');
      }

      const result = await this.enrollmentService.digitalContractSigning(
        user.userId,
        enrollmentId,
        accepted,
        signature_full_name,
        signature,
        signature_date,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Error accepting contract terms');
    }
  }

  @ApiOperation({ summary: 'Get my courses' })
  @Get('my-courses')
  async myCourses(@GetUser() user) {
    try {
      const result = await this.enrollmentService.myCourses(user.userId);
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching my courses');
    }
  }
}
