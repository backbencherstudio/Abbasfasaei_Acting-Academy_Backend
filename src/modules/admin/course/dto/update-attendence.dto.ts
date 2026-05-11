import { ApiProperty } from '@nestjs/swagger';
import { CreateAttendenceDto } from './create-attendence.dto';
import { IsString } from 'class-validator';

export class UpdateAttendenceDto extends CreateAttendenceDto {
  @ApiProperty({ description: 'Attendance status', example: 'PRESENT/ABSENT' })
  @IsString()
  status: string;
}
