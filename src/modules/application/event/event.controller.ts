import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventService } from './event.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@DisAllowDeactivated()
@Controller('events')
export class EventController {
  constructor(private eventsService: EventService) { }

  @Get()
  getAllEvents(@GetUser('userId') user_id: string) {
    return this.eventsService.getAllEvents(user_id);
  }

  @Get(':event_id')
  getEventById(@Param('event_id') event_id: string, @GetUser('userId') user_id: string) {
    return this.eventsService.getEventById(event_id, user_id);
  }
}
