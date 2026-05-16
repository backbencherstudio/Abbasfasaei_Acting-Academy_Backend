import { ApiProperty, OmitType } from "@nestjs/swagger";
import { IsDate, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { Transform, Type } from "class-transformer";

export enum EventStatus {
    UPCOMING = 'UPCOMING',
    COMPLETED = 'COMPLETED',
}

export class QueryEventDto {

    @ApiProperty({
        description: 'Search query',
        required: false,
        example: 'math',
    })
    @IsString()
    @IsOptional()
    search: string;

    @ApiProperty({
        description: 'Page number',
        required: false,
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page: number = 1;

    @ApiProperty({
        description: 'Limit number',
        required: false,
        example: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit: number = 10;

    @ApiProperty({
        description: 'Status',
        required: false,
        example: 'ACTIVE',
    })
    @IsEnum(EventStatus)
    @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : value.toUpperCase())
    @IsOptional()
    status?: EventStatus;
}

export class QueryEventMembersDto extends OmitType(QueryEventDto, ["status"]) {

    @ApiProperty({
        description: 'Start date',
        required: false,
        example: '2022-01-01',
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    startDate: Date;

    @ApiProperty({
        description: 'End date',
        required: false,
        example: '2022-12-31',
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    endDate: Date;

}
