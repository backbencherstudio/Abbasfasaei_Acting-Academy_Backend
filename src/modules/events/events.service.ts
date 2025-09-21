import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EventsService {

    constructor(private prisma: PrismaService) {}

    async getAllEvents() {
        return this.prisma.event.findMany();
    }

    async getEventById(id: string) {
        return this.prisma.event.findUnique({
            where: { id },
        });
    }


    async eventPayment(user: any) {}

}
