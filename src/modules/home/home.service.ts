import { Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class HomeService {

    constructor(private prisma: PrismaService) {}

     async getHome(userId: string) {
    
            const enrollmentStatus = await this.prisma.enrollment.findUnique({
                where: {
                    id: userId
                },
            })
    
            const now = new Date();
            if (enrollmentStatus.payment_status === PaymentStatus.PAID) {
    
    
                const [upcomingClasses, upcomingAssignments, upcomingEvents] = await Promise.all([
                    // Upcoming Classes
                    this.prisma.moduleClass.findMany({
                        where: {
                            start_date: { gt: now },
                            module: {
                                course: {
                                    enrollments: {
                                        some: {
                                            user_id: userId,
                                            status: 'ACTIVE'
                                        }
                                    }
                                }
                            }
                        },
                        select: {
                            id: true,
                            class_title: true,
                            class_name: true,
                            duration: true,
                            start_date: true,
                            class_time: true,
                            module: {
                                select: {
                                    course: {
                                        select: {
                                            fee: true,
                                            instructor: {
                                                select: {
                                                    id: true,
                                                    name: true
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        orderBy: { start_date: 'asc' },
                        take: 10
                    }),
    
                    // Upcoming Assignments
                    this.prisma.assignment.findMany({
                        where: {
                            due_date: { gt: now },
                            moduleClass: {
                                module: {
                                    course: {
                                        enrollments: {
                                            some: {
                                                user_id: userId,
                                                status: 'ACTIVE'
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        select: {
                            id: true,
                            title: true,
                            due_date: true,
                            submission_Date: true,
                            total_marks: true,
                            teacher: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        },
                        orderBy: { due_date: 'asc' },
                        take: 10
                    }),
    
                    // Upcoming Courses
                    this.prisma.course.findMany({
                        where: {
                            start_date: { gt: now },
                            enrollments: {
                                some: {
                                    user_id: userId,
                                    status: 'ACTIVE'
                                }
                            }
                        },
                        select: {
                            id: true,
                            title: true,
                            fee: true,
                            duration: true,
                            start_date: true,
                            class_time: true,
                            seat_capacity: true,
                            instructor: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        },
                        orderBy: { start_date: 'asc' },
                        take: 5
                    }),
    
                    // Upcoming Events
                    this.prisma.event.findMany({
                        where: {
                            date: { gt: now },
                            status: 'UPCOMING'
                        },
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            overview: true,
                            date: true,
                            time: true,
                            location: true,
                            amount: true,
                            creator: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            },
                            members: {
                                where: { user_id: userId },
                                select: {
                                    user_id: true
                                }
                            }
                        },
                        orderBy: { date: 'asc' },
                        take: 10
                    })
                ]);
    
                return {
                    upcomingClasses,
                    upcomingAssignments,
                    upcomingEvents
                };
            }
    
            else {
    
                const upcomingCourses = this.prisma.course.findMany({
                    where: {
                        start_date: { gt: now },
                        enrollments: {
                            some: {
                                user_id: userId,
                                status: 'ACTIVE'
                            }
                        }
                    },
                    select: {
                        id: true,
                        title: true,
                        fee: true,
                        duration: true,
                        start_date: true,
                        class_time: true,
                        seat_capacity: true,
                        instructor: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },
                    orderBy: { start_date: 'asc' },
                    take: 5
                })
    
                return {
                    upcomingCourses
                }
            }
        }
}
