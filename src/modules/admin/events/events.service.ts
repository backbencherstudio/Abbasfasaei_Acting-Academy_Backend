import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EventsService {
    constructor (private prisma: PrismaService) {}

    async getAllEvents() {
        const events = await this.prisma.event.findMany({})

        return events;
    }

    async getEventById(eventId: string) {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId }
        })
        return event;
    }
}

