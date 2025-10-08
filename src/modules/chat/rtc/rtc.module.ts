import { Module, forwardRef } from '@nestjs/common';
import { RtcController } from './rtc.controller';
import { RtcService } from './rtc.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ConversationsModule)],
  controllers: [RtcController],
  providers: [RtcService],
  exports: [RtcService],
})
export class RtcModule {}
