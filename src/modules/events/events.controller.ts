import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';



@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  getAllEvents() {
    return this.eventsService.getAllEvents();
  }

  @Get('/:id')
  getEventById(
    @Param('id') id: string
  ) {
    return this.eventsService.getEventById(id);
  }

  @Post('/eventpayment')
  eventPayment(
    @GetUser() user: any,
  ) {
    return this.eventsService.eventPayment(user);

  }
}
