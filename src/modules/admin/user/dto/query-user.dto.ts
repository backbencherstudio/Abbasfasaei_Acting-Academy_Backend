import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from 'src/common/guard/role/role.enum';
import { UserStatus } from 'src/common/constants/user-status.enum';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class QueryUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    Role[value.toUpperCase()] ? Role[value.toUpperCase()] : undefined,
  )
  @IsEnum(Role)
  type?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    UserStatus[value.toUpperCase()]
      ? UserStatus[value.toUpperCase()]
      : undefined,
  )
  @IsEnum(UserStatus)
  status?: UserStatus;
}
