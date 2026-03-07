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
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PaymentDto } from './dto/paymentDto.dto';
import { CombinedEnrollmentDto } from './dto/combined-enrollment.dto';

@ApiBearerAuth()
@ApiTags('Student Management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/student-management')
export class StudentManagementController {
  constructor(
    private readonly studentManagementService: StudentManagementService,
  ) {}

  @ApiTags('Manual Enrollment Combined')
  @Post('manual-enrollment')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'rules_signing', maxCount: 1 },
        { name: 'contract_signing', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  async manualEnrollmentCombined(
    @GetUser() user: any,
    @Body() dto: CombinedEnrollmentDto,
    @UploadedFiles()
    files: {
      rules_signing?: Express.Multer.File[];
      contract_signing?: Express.Multer.File[];
    },
  ) {
    return this.studentManagementService.combinedEnrollment(
      user.userId,
      dto,
      files,
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
