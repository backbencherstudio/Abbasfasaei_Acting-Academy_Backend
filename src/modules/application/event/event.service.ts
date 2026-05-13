import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EventRegistrationStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) { }

  async getAllEvents(user_id: string) {
    if (!user_id) throw new UnauthorizedException('User not found');

    const now = new Date();

    const events = await this.prisma.event.findMany({
      where: {
        start_at: {
          gte: now,
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        start_at: true,
        time: true,
        registrations: {
          where: {
            user_id: user_id,
            status: EventRegistrationStatus.CONFIRMED,
            order: {
              status: OrderStatus.PAID,
            },
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
      orderBy: {
        start_at: 'asc',
      },
    });

    const next_event = events.length > 0 ? events[0] : null;

    return {
      success: true,
      message: "Events fetched successfully",
      data: events.map((event, index) => {
        const registration = event.registrations[0];

        const { registrations, ...eventData } = event;

        let status = 'pending';
        if (next_event && event.id === next_event.id) {
          status = 'next';
        } else if (index > 0) {
          status = 'upcoming';
        }

        return {
          ...eventData,
          is_registered: !!registration,
          status: status,
        };
      }),
    };
  }

  async getEventById(event_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException('User not found');
    if (!event_id) throw new BadRequestException('Invalid Event Id');

    const now = new Date();

    const event = await this.prisma.event.findUnique({
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
        registrations: {
          where: {
            user_id: user_id,
            status: EventRegistrationStatus.CONFIRMED,
            order: {
              status: OrderStatus.PAID,
            },
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');


    const nextEvent = await this.prisma.event.findFirst({
      where: {
        start_at: { gte: now },
      },
      orderBy: {
        start_at: 'asc',
      },
      select: { id: true },
    });

    let status = 'pending';
    if (nextEvent && event.id === nextEvent.id) {
      status = 'next';
    } else if (event.start_at > now) {
      status = 'upcoming';
    }

    const { registrations, ...eventData } = event;

    return {
      success: true,
      message: "Event fetched successfully",
      data: {
        ...eventData,
        fee: event.amount_pence > 0 ? event.amount_pence / 100 : 0,
        is_registered: !!registrations?.[0],
        status: status
      },
    };
  }

}
