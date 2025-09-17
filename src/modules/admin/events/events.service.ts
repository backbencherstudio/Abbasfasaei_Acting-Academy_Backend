import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { addEventDto } from './dto/addevent.dto';

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

      console.log("id: ", creator.name);
      console.log(dto);

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
          created_by: creator.name,
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
}
