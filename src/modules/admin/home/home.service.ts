import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class HomeService {
    constructor(private readonly prisma: PrismaService) {}

    async getEnrols() {
        return this.prisma.enrollment.findMany({})
    }

    async getHome(userId: string) {

        const isEnrolled = await this.prisma.enrollment.findUnique({
            where: {
                id: userId
            }
        })

        if (!isEnrolled) {
            
        }
    }
}
