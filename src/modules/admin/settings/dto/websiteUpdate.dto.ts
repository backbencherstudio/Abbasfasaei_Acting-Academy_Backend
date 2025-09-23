import { IsOptional, IsString } from "class-validator";

export class WebsiteSettingsDto {
    @IsOptional()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    phone_number: string;

    @IsOptional()
    @IsString()
    email: string;

    @IsOptional()
    @IsString()
    address: string;
}