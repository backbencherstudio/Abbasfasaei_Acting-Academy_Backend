import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { UserStatus } from 'src/common/constants/user-status.enum';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: 'The status of the user',
    enum: UserStatus,
    example: 'BLOCKED',
  })
  @IsOptional()
  @Transform(({ value }) =>
    UserStatus[value.toUpperCase()]
      ? UserStatus[value.toUpperCase()]
      : undefined,
  )
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'The status of the user',
    enum: UserStatus,
    example: 'BLOCKED',
  })
  @IsNotEmpty()
  @Transform(({ value }) =>
    UserStatus[value.toUpperCase()]
      ? UserStatus[value.toUpperCase()]
      : undefined,
  )
  @IsEnum(UserStatus)
  status: UserStatus;
}
