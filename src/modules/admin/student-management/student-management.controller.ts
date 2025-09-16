import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { StudentManagementService } from './student-management.service';
import { CreateStudentManagementDto } from './dto/create-student-management.dto';
import { UpdateStudentManagementDto } from './dto/update-student-management.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { EnrollDto } from 'src/modules/enrollment/dto/enroll.dto';

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
  @Post()
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
    @Body() paymentDto: any,
  ) {
    return this.studentManagementService.manualEnrollmentPayment(
      enrollmentId,
      paymentDto,
    );
  }

  @ApiTags('Get All Students')
  @Get()
  async getAllStudents(@GetUser() user: any) {
    console.log('user in controller:', user);
    return this.studentManagementService.getAllStudents(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentManagementService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateStudentManagementDto: UpdateStudentManagementDto,
  ) {
    return this.studentManagementService.update(
      +id,
      updateStudentManagementDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.studentManagementService.remove(+id);
  }
}
