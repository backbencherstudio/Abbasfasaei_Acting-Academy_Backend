import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateUserSettingsDto {
  @IsOptional()
  @ApiProperty()
  firstName?: string;

  @IsOptional()
  @ApiProperty()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @ApiProperty()
  email?: string;

  // Password fields are optional, but if any password field is provided, all are required
  @ValidateIf((o) => o.newPassword || o.confirmNewPassword)
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ required: false })
  currentPassword?: string;

  @ValidateIf((o) => o.currentPassword || o.confirmNewPassword)
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @ApiProperty({ required: false })
  newPassword?: string;

  @ValidateIf((o) => o.currentPassword || o.newPassword)
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ required: false })
  confirmNewPassword?: string;
}
