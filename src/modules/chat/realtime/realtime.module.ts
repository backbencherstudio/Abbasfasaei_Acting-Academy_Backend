import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { TwilioVideoService } from './twilio-video.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [
    PrismaModule,
    PresenceModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRY || '1d' },
    }),
  ],
  providers: [RealtimeGateway, TwilioVideoService],
  exports: [RealtimeGateway, TwilioVideoService],
})
export class RealtimeModule {}
