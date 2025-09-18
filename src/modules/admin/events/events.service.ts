import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { addEventDto } from './dto/addevent.dto';
import { updateEventDto } from './dto/updateEventDto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async getAllEvents() {
    const events = await this.prisma.event.findMany({});

    return events;
  }

  async getEventById(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });
    return event;
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
        data: { creator, event },
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

      const event = await this.prisma.event.update({
        where: { id: eventId },
        data: {
          ...dto,
        },
      });

      return {
        success: true,
        message: 'Event updated successfully',
        data: { event, creator },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
