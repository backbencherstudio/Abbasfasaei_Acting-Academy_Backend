import { SetMetadata } from '@nestjs/common';

export const DISALLOW_DEACTIVATED_KEY = 'disallowDeactivated';
export const DisAllowDeactivated = () => SetMetadata(DISALLOW_DEACTIVATED_KEY, true);
