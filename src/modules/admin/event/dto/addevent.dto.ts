import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class addEventDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Hip Hop Fest' })
  name: string;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  @ApiProperty({ example: '2026-06-01' })
  start_at: Date;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '09:00' })
  time: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Location' })
  location: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ example: '25.00' })
  amount: number = 0;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Event Description' })
  description: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Hip hop is a culture and art movement that originated in the Bronx, New York City, during the 1970s. It is characterized by four key elements: MCing (rapping), DJing (turntablism), graffiti art, and breakdancing. Hip hop has evolved into a global phenomenon, influencing music, fashion, language, and popular culture worldwide.' })
  overview: string;
}
