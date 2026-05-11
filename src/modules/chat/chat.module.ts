import { Module } from '@nestjs/common';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RtcModule } from './rtc/rtc.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    RealtimeModule,
    ConversationsModule,
    MessagesModule,
    UploadsModule,
    RtcModule,
    UsersModule,
  ],
})
export class ChatModule {}
