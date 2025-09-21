import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { StudentManagementService } from './student-management.service';
import { UpdateStudentManagementDto } from './dto/update-student-management.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { EnrollDto } from 'src/modules/enrollment/dto/enroll.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PaymentDto } from './dto/paymentDto.dto';

@ApiBearerAuth()
@ApiTags('Student Management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/student-management')
export class StudentManagementController {
  constructor(
    private readonly studentManagementService: StudentManagementService,
  ) {}

  @ApiTags('Create Enrollment')
  @Post('enroll')
  async manualEnrollment(
    @GetUser() user: any,
    @Body() createStudentManagementDto: EnrollDto,
  ) {
    return this.studentManagementService.manualEnrollment(
      user.userId,
      createStudentManagementDto,
    );
  }

  @ApiTags('Manual Enrollment Payment')
  @Post(':enrollmentId/payment')
  async manualEnrollmentPayment(
    @Param('enrollmentId') enrollmentId: string,
    @Body() paymentDto: PaymentDto,
  ) {
    return this.studentManagementService.manualEnrollmentPayment(
      enrollmentId,
      paymentDto,
    );
  }

  @ApiTags('Manual Enrollment Contract Document')
  @Post(':enrollmentId/contract')
  @UseInterceptors(
    FilesInterceptor('media', 5, {
      storage: memoryStorage(),
    }),
  )
  async manualEnrollmentContractDoc(
    @Param('enrollmentId') enrollmentId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.studentManagementService.manualEnrollmentContractDocs(
      enrollmentId,
      files,
    );
  }

  @ApiTags('Preview Enrollment Contract Document')
  @Get(':enrollmentId/preview-contract')
  async getEnrollmentPreviewContractDoc(
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.studentManagementService.getEnrollmentPreviewContractDoc(
      enrollmentId,
    );
  }

  @ApiTags('Get Student By ID')
  @Get('student/:studentId')
  async getStudentById(@Param('studentId') studentId: string) {
    return this.studentManagementService.getStudentById(studentId);
  }

  @ApiTags('Get All Students')
  @Get()
  async getAllStudents(@GetUser() user: any) {
    console.log('user in controller:', user);
    return this.studentManagementService.getAllStudents(user.userId);
  }

  @ApiTags('Update Enrollment Info')
  @Patch('enrollment/:enrollmentId')
  async updateEnrollmentInfo(
    @Param('enrollmentId') enrollmentId: string,
    @Body() updateData: any,
  ) {
    return this.studentManagementService.updateEnrollmentInfo(
      enrollmentId,
      updateData,
    );
  }

  @ApiTags('Restrict enrollment Access')
  @Patch('enrollment/:enrollmentId/restrict')
  async restrictStudentAccess(
    @Param('enrollmentId') enrollmentId: string,
    @Body() updateData: any,
  ) {
    return this.studentManagementService.restrictStudentAccess(
      enrollmentId,
      updateData,
    );
  }
}
