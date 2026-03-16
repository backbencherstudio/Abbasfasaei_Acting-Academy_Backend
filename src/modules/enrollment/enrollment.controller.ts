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
import {
  AcceptRulesOrContractDto,
  EnrollDto,
  PInfoDto,
} from './dto/enroll.dto';
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

  @Get('current-step/:courseId')
  async getCurrentStep(@GetUser() user, @Param('courseId') courseId: string) {
    try {
      const result = await this.enrollmentService.getCurrentStep(
        user.userId,
        courseId,
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching current step');
    }
  }

  @ApiOperation({ summary: 'Enroll user in a course' })
  @Post('pinfo/:courseId')
  async enrollUser(
    @GetUser() user,
    @Param('courseId') courseId: string,
    @Body() dto: PInfoDto,
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
  @Post('accept-rules/:enrollmentId')
  async acceptRules(
    @GetUser() user,
    @Param('enrollmentId') enrollmentId: string,
    @Body()
    dto: AcceptRulesOrContractDto,
  ) {
    if (
      !dto?.digital_signature_date ||
      isNaN(Date.parse(dto?.digital_signature_date))
    ) {
      throw new BadRequestException('Invalid signature date');
    }

    const result = await this.enrollmentService.acceptRules(
      user.userId,
      enrollmentId,
      dto,
    );
    return result;
  }

  @ApiOperation({ summary: 'Accept contract terms' })
  @Post('accept-contract/:enrollmentId')
  async acceptContract(
    @GetUser() user,
    @Param('enrollmentId') enrollmentId: string,
    @Body()
    dto: AcceptRulesOrContractDto,
  ) {
    try {
      if (
        !dto.digital_signature_date ||
        isNaN(Date.parse(dto.digital_signature_date))
      ) {
        throw new BadRequestException('Invalid signature date');
      }

      const result = await this.enrollmentService.acceptContract(
        user.userId,
        enrollmentId,
        dto,
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
