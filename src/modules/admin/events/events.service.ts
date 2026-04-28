import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { addEventDto } from './dto/addevent.dto';
import { updateEventDto } from './dto/updateEventDto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async getAllEvents(search: string) {
    const events = await this.prisma.event.findMany({
      where: {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      },
    });

    return events;
  }

  async getEventById(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone_number: true,
                avatar: true,
              },
            },
          },
          orderBy: { created_at: 'asc' },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    if (!event) {
      return {
        success: false,
        message: 'Event not found',
      };
    }

    return {
      success: true,
      message: 'Event fetched successfully',
      data: {
        ...event,
        members: event.members.map((member) => ({
          ...member,
          event_amount: event.amount,
          event_date: event.date,
          event_name: event.name,
        })),
        registeredMembersCount: event.members.length,
      },
    };
  }

  async addEvent(dto: addEventDto, userId: string) {
    try {
      const creator = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!creator) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const event = await this.prisma.event.create({
        data: {
          name: dto.title,
          date: dto.date,
          time: dto.time,
          location: dto.location,
          amount: dto.amount,
          description: dto.description,
          created_by: creator.id,
        },
      });

      return {
        success: true,
        message: 'Event created successfully',
        data: event,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async editEvent(userId: string, eventId: string, dto: updateEventDto) {
    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
      };
    }

    try {
      const creator = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!creator) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const event = await this.prisma.event.update({
        where: { id: eventId },
        data: {
          ...dto,
        },
      });

      return {
        success: true,
        message: 'Event updated successfully',
        data: event,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
