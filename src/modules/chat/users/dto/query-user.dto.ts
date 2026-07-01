import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

enum DiscoverUserType {
  ALL = 'all',
  STUDENT = 'student',
  ADMIN = 'admin',
  TEACHER = 'teacher',
}

export class QueryDiscoverUsersDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    DiscoverUserType[value.toUpperCase()]
      ? DiscoverUserType[value.toUpperCase()]
      : 'all',
  )
  @IsEnum(DiscoverUserType)
  type?: DiscoverUserType;
}
