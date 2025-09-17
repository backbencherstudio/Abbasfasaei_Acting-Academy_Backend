import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum AssignableUserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export class SetUserRoleDto {
  @ApiProperty({ enum: AssignableUserRole, description: 'Role to assign' })
  @IsEnum(AssignableUserRole)
  role: AssignableUserRole;
}
