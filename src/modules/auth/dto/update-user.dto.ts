import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
  })
  name?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Username',
    example: 'johndoe',
  })
  username?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Phone number',
    example: '+91 9876543210',
  })
  phone_number?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @ApiProperty({
    description: 'Date of Birth',
    example: '2001-11-14',
  })
  date_of_birth?: Date;

  @IsOptional()
  @ApiProperty({
    description: 'Experience Level',
    example: 'Intermediate',
  })
  experience?: string

  @IsOptional()
  @ApiProperty({
    description: 'about',
    example: 'i am a actor',
  })
  about?: string;

  avatar?: any;

  cover_image?: any;
}
