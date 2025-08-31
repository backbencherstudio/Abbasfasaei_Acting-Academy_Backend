import { Module, forwardRef } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, UsersModule, forwardRef(() => ConversationsModule)],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
