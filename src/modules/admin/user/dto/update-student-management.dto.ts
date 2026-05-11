import { PartialType } from '@nestjs/mapped-types';
import { CreateStudentManagementDto } from './create-student-management.dto';

export class UpdateStudentManagementDto extends PartialType(CreateStudentManagementDto) {}
