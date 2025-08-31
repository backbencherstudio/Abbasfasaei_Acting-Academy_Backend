import { IsString } from 'class-validator';
export class CreateDmDto {
  @IsString()
  otherUserId: string;
}
