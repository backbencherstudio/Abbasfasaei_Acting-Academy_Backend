import { Controller, Get, Param } from '@nestjs/common';
import { EventsService } from './events.service';
import { ApiResponse } from '@nestjs/swagger';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @ApiResponse({ description: 'Get all teacher' })
  @Get()
  async getAllEvents() {
    return this.eventsService.getAllEvents();
  }

  @ApiResponse({ description: "Get Event by Id" })
  @Get(':id')
  async getEventById(
    @Param ('id') id: string) {
    return this.eventsService.getEventById(id);
  }
}
