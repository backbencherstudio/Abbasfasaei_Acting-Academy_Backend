
import { OmitType } from "@nestjs/swagger"
import { Type } from "class-transformer"
import { IsNumber, IsOptional, IsString } from "class-validator"

export class QueryCommunityFeedDto {

    @IsOptional()
    @IsString()
    user_id?: string

    @IsOptional()
    @IsString()
    search?: string

    @IsOptional()
    @IsString()
    cursor?: string

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number = 10
}

export class QueryCommunityPostLikesDto extends OmitType(QueryCommunityFeedDto, ["search", 'user_id']) {

}