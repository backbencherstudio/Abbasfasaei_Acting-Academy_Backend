import { IsString } from "class-validator";

export class WebsiteSettingsDto {
    @IsString()
    name: string;

    @IsString()
    phone_number: string;

    @IsString()
    email: string;

    @IsString()
    address: string;
}