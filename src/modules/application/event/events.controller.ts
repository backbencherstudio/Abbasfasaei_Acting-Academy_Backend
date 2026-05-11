import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@DisAllowDeactivated()
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  getAllEvents() {
    return this.eventsService.getAllEvents();
  }

  @Get('/:id')
  getEventById(@Param('id') id: string) {
    return this.eventsService.getEventById(id);
  }
}
