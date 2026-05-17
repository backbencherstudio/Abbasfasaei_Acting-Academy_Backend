import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserStatus } from 'src/common/constants/user-status.enum';

export class UpdateUserDto extends PartialType(CreateUserDto) { }

export class UpdateUserStatusDto {
    @ApiProperty({
        description: 'The status of the user',
        enum: UserStatus,
        example: 'BLOCKED',
    })
    @IsNotEmpty()
    @Transform(({ value }) => UserStatus[value] ? UserStatus[value] : undefined)
    @IsEnum(UserStatus)
    status: UserStatus;
}
