import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { addEventDto } from './dto/addevent.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { updateEventDto } from './dto/updateEventDto';
import { QueryEventDto } from './dto/query-event.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) { }

  @Get()
  async getAllEvents(@Query() query: QueryEventDto, @GetUser('userId') user_id: string) {
    return this.eventsService.getAllEvents(user_id, query);
  }
  @Get(':event_id')
  async getEventById(@Param('event_id') event_id: string, @GetUser('userId') user_id: string) {
    return this.eventsService.getEventById(user_id, event_id);
  }
  @Post()
  async addEvent(@GetUser('userId') user_id: string, @Body() addEventDto: addEventDto) {
    return this.eventsService.addEvent(addEventDto, user_id);
  }
  @Patch(':event_id')
  async editEvent(
    @GetUser('userId') user_id: string,
    @Body() dto: updateEventDto,
    @Param('event_id') event_id: string,
  ) {
    return this.eventsService.editEvent(user_id, event_id, dto);
  }
}
