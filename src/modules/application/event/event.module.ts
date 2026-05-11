import { Module } from '@nestjs/common';
import { EventsModule } from './events.module';

@Module({
  imports: [EventsModule],
})
export class EventModule {}
