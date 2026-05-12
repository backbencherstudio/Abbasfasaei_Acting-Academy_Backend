import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateModuleDto {

  @ApiProperty({
    example: 'Module Name',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  module_name: string;

  @ApiProperty({
    example: 'Module Title',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  module_title: string;

  @ApiProperty({
    example: 'Module Overview',
    required: false,
  })
  @IsString()
  @IsOptional()
  module_overview?: string;
}
