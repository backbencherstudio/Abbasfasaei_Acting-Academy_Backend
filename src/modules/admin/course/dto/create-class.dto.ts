import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateClassDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  class_title: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  class_name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  class_overview?: string;

  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  duration: number;

  @ApiProperty()
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  class_date: Date;

  @ApiProperty()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 4) {
        const hours = parseInt(digits.substring(0, 2), 10);
        const minutes = parseInt(digits.substring(2, 4), 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      }
      throw new Error('Invalid time format. Use HH:MM (e.g., "17:00").');
    }
    return value;
  })
  @IsString()
  class_time: string;
}
