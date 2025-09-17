import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
} from 'class-validator';

export class addEventDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Hip Hop Fest' })
  title: string;

  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({ example: 'YYYY-MM-DD' })
  date: Date;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'HH:MM' })
  time: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Location' })
  location: string;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ example: 'Amount' })
  amount: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Event Description' })
  description: string;
}
