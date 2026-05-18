import { ConversationType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";

export class ConversationQueryDto {
    @IsOptional()
    @Transform(({ value }) => ConversationType[value.toUpperCase()] ? ConversationType[value.toUpperCase()] : undefined)
    @IsEnum(ConversationType)
    type?: ConversationType;

    @IsOptional()
    @IsString()
    cursor?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number = 10
}