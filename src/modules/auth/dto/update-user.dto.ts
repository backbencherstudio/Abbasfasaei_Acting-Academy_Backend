import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
  })
  name?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Phone number',
    example: '+91 9876543210',
  })
  phone_number?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Date of Birth',
    example: '14/11/2001',
  })
  date_of_birth?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Experience Level',
    example: 'Intermediate',
  })
  experience_level?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Acting Goals',
    example: 'Become a lead actor in a major film',
  })
  acting_goals?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Profile image',
    example: 'http://localhost:4000/api/users/avatar/1234567890',
  })
  avatar?: string;
}
