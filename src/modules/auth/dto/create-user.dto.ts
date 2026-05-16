import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @ApiProperty()
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  @ApiProperty()
  password: string;

  @ApiProperty({
    type: String,
    example: 'user',
  })
  type?: string;
}


export class UserLoginDto {
  @IsNotEmpty()
  @ApiProperty()
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  @ApiProperty()
  password: string;

}

export class ForgotPasswordDto {
  @IsNotEmpty()
  @ApiProperty()
  email: string;
}

export class VerifyEmailDto {
  @IsNotEmpty()
  @ApiProperty()
  email: string;

  @IsNotEmpty()
  @ApiProperty()
  token: string;
}
