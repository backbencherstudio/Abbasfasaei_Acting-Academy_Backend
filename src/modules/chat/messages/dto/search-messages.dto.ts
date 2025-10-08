import { Transform } from 'class-transformer';
import { IsUUID, IsOptional, IsInt, Min, Max, IsString, Length } from 'class-validator';

export class SearchMessagesDto {
  @IsString()
  @Length(0, 200)
  @Transform(({ value }) => (value ?? '').toString().trim())
  q: string = '';

  @IsOptional()
  @IsUUID('4')
  conversationId?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  skip: number = 0;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  take: number = 20;
}
