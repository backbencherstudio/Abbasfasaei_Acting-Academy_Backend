import { PartialType } from '@nestjs/mapped-types';
import { CreateCommunityManagementDto } from './create-community-management.dto';

export class UpdateCommunityManagementDto extends PartialType(CreateCommunityManagementDto) {}
