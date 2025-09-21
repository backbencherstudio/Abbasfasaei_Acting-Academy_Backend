import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { add } from 'date-fns';
import { addEventDto } from './dto/addevent.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { updateEventDto } from './dto/updateEventDto';


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

  @ApiResponse({ description : "Edit an Event" })
  @Patch('update/:id')
  async editEvent(
    @GetUser() user: any,
    @Body() dto : updateEventDto,
    @Param('id') id : string
  ) {
    return this.eventsService.editEvent(user.userId, id, dto)
  }
}
