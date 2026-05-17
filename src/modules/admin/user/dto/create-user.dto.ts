import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { Role } from 'src/common/guard/role/role.enum';

export class CreateUserDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'The name of the user',
    example: 'John Doe',
  })
  name: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'The email of the user',
    example: 'john.doe@example.com',
  })
  email: string;

  @IsOptional()
  @ApiProperty({
    description: 'The phone of the user',
    example: '1234567890',
  })
  phone?: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'The password of the user',
    example: 'password',
  })
  password: string;

  @IsOptional()
  @ApiProperty({
    description: 'The type of the user',
    enum: Role,
    example: Role.USER,
  })
  @Transform(({ value }) => value?.trim()?.toLowerCase())
  @IsEnum(Role)
  type?: Role;

  @IsOptional()
  @ApiProperty({
    description: 'The join date of the user',
    example: '2022-01-01',
  })
  @Type(() => Date)
  @IsDate()
  join_date?: Date;

  @IsOptional()
  @ApiProperty({
    description: 'The experience of the user',
    example: '5 years',
  })
  experience?: string;
}
