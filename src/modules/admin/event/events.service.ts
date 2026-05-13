import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { addEventDto } from './dto/addevent.dto';
import { updateEventDto } from './dto/updateEventDto';
import { EventStatus, QueryEventDto } from './dto/query-event.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) { }

  async getAllEvents(user_id: string, query: QueryEventDto) {
    if (!user_id) throw new UnauthorizedException('User not found');

    const { page, limit, search, status } = query;
    const now = new Date();
    let where: Prisma.EventWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { overview: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) {
      if (status === EventStatus.COMPLETED) {
        where.start_at = { lt: now };
      } else if (status === EventStatus.UPCOMING) {
        where.start_at = { gte: now };
      }
    }

    const [events, total, nextEvent] = await Promise.all([
      this.prisma.event.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          start_at: true,
          time: true,
          location: true,
          amount_pence: true,
        },
        orderBy: { start_at: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.event.count({ where }),
      this.prisma.event.findFirst({
        where: { start_at: { gte: now } },
        orderBy: { start_at: 'asc' },
        select: { id: true }
      })
    ]);

    const formattedEvents = events.map(event => {
      let eventStatus = 'completed';

      if (event.start_at >= now) {
        eventStatus = (nextEvent && event.id === nextEvent.id) ? 'next' : 'upcoming';
      }

      return {
        ...event,
        amount: event.amount_pence > 0 ? event.amount_pence / 100 : 0,
        status: eventStatus
      };
    });

    return {
      success: true,
      message: "Events fetched successfully",
      data: formattedEvents,
      meta_data: {
        page,
        limit,
        total,
        search,
        status
      }
    };
  }

  async getEventById(user_id: string, event_id: string) {
    if (!user_id) throw new UnauthorizedException('User not found');
    if (!event_id) throw new BadRequestException('Invalid Event Id');

    const now = new Date();

    const [event, nextEvent] = await Promise.all([
      this.prisma.event.findUnique({
        where: { id: event_id },
        select: {
          id: true,
          name: true,
          description: true,
          overview: true,
          location: true,
          start_at: true,
          time: true,
          amount_pence: true,

        },
      }),
      this.prisma.event.findFirst({
        where: { start_at: { gte: now } },
        orderBy: { start_at: 'asc' },
        select: { id: true },
      }),
    ]);

    if (!event) throw new NotFoundException('Event not found');

    let eventStatus = 'completed';
    if (event.start_at >= now) {
      eventStatus = (nextEvent && event.id === nextEvent.id) ? 'next' : 'upcoming';
    }

    return {
      success: true,
      message: "Event fetched successfully",
      data: {
        ...event,
        amount: event.amount_pence > 0 ? event.amount_pence / 100 : 0,
        status: eventStatus,
      },
    };
  }

  async addEvent(dto: addEventDto, user_id: string) {

    if (!user_id) throw new UnauthorizedException('User not found');

    const event = await this.prisma.event.create({
      data: {
        name: dto.name,
        start_at: dto.start_at,
        time: dto.time,
        location: dto.location,
        amount_pence: dto.amount * 100,
        description: dto.description,
        overview: dto.overview,
        created_by: user_id,
      },
    });
    if (!event) throw new BadRequestException("Failed to create event")

    return {
      success: true,
      message: 'Event created successfully',
    };

  }

  async editEvent(user_id: string, event_id: string, dto: updateEventDto) {
    if (!user_id) throw new UnauthorizedException('User not found');
    if (!event_id) throw new BadRequestException('Invalid Event Id');



    const creator = await this.prisma.user.findUnique({
      where: { id: user_id },
    });

    if (!creator) throw new UnauthorizedException('User not found');

    const existingEvent = await this.prisma.event.findUnique({
      where: { id: event_id }
    })
    if (!existingEvent) throw new NotFoundException('Event not found');

    const event = await this.prisma.event.update({
      where: { id: event_id },
      data: {
        name: dto.name ?? existingEvent.name,
        time: dto.time ?? existingEvent.time,
        location: dto.location ?? existingEvent.location,
        start_at: dto.start_at ?? existingEvent.start_at,
        amount_pence: dto.amount ? dto.amount * 100 : existingEvent.amount_pence,
        description: dto.description ?? existingEvent.description,
        overview: dto.overview ?? existingEvent.overview,
      },
    });

    if (!event) throw new BadRequestException("Failed to update event")

    return {
      success: true,
      message: 'Event updated successfully',
    };

  }
}
