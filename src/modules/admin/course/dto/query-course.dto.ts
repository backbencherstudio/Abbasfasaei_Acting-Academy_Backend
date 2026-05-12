import { ApiProperty } from "@nestjs/swagger";
import { AssignmentSubmissionStatus, CourseStatus } from "@prisma/client";
import { AssignmentStatus } from "aws-sdk/clients/mturk";
import { Transform, Type } from "class-transformer";
import { IsOptional, IsString, IsNumber, IsEnum } from "class-validator";

export class GetAllCourseQueryDto {

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
    @IsEnum(CourseStatus)
    @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : value.toUpperCase())
    @IsOptional()
    status?: CourseStatus;
}

export class GetAllAssignmentQueryDto {

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
        example: 'ALL',
    })
    @IsEnum(AssignmentSubmissionStatus)
    @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : value.toUpperCase())
    @IsOptional()
    status?: AssignmentSubmissionStatus;
}