import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { add } from 'date-fns';
import { addEventDto } from './dto/addevent.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';


@ApiBearerAuth()
@UseGuards(JwtAuthGuard)

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

  @ApiResponse({ description : "Add an Event" })
  @Post()
  async addEvent(
    @GetUser() user: any,
    @Body() addEventDto : addEventDto
  ) {
    return this.eventsService.addEvent(addEventDto, user.userId)
  }
}
