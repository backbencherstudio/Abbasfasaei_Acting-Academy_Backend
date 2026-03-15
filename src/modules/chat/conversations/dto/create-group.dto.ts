import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateGroupDto {
  @ApiProperty({
    description: 'Group conversation title',
    example: 'Product Team',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Initial members to add into the group',
    type: [String],
    example: ['cmmlhoxaa0000v83s6kxio16b', 'cmmliufke0000v8xs48uyxj6p'],
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    const raw = String(value ?? '').trim();
    if (!raw) {
      return [];
    }

    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        return [];
      }
    }

    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberIds: string[];

  @ApiProperty({
    description: 'Optional group avatar image file',
    type: 'string',
    format: 'binary',
  })
  avatar?: Express.Multer.File;
}
