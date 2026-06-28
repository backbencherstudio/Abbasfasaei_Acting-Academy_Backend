import { PickType } from '@nestjs/swagger';
import { CreateConversationDto } from './create-conversation.dto';

export class UpdateConversationDto extends PickType(CreateConversationDto, [
  'title',
]) {}
