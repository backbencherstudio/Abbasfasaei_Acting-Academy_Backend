import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EventsService {
    constructor (private prisma: PrismaService) {}

    async getEvents() {
        const events = await this.prisma.event.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                overview: true,
                date: true,
                time: true,
                location: true,
                amount: true,
                status: true,  
            }
        })
    }
}

// try not to use "select" and call all

/*

date        DateTime
  time        String?
  location    String
  amount      Decimal?
  status      EventStatus @default(UPCOMING)

  // File attachments (receipts, invoices, etc.)
  files Json? // Array of file URLs or metadata

  // Relations
  created_by String
  creator    User           @relation("EventCreator", fields: [created_by], references: [id])
  members    EventMember[]
  payments   EventPayment[]

*/
