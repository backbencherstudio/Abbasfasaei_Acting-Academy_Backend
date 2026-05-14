import { Injectable } from '@nestjs/common';
// import { PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) { }

  async getHome(userId: string) {
    const [user, enrollment] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
      this.prisma.enrollment.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const userProfile = {
      name: user?.name || 'User',
    };

    const now = new Date();
    if (enrollment?.status === 'ACTIVE') {
      const [rawClasses, rawAssignments, rawEvents] = await Promise.all([
        // Upcoming Classes
        this.prisma.moduleClass.findMany({
          where: {
            start_at: { gt: now },
            module: {
              course: {
                enrollments: {
                  some: {
                    user_id: userId,
                    status: 'ACTIVE',
                  },
                },
              },
            },
          },
          select: {
            id: true,
            class_title: true,
            class_name: true,
            duration: true,
            start_at: true,
            class_at: true,
            module: {
              select: {
                module_name: true,
                module_title: true,
                course: {
                  select: {
                    title: true,
                    instructor: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            class_assets: {
              select: {
                id: true,
                type: true,
                file_path: true,
              },
            },
          },
          orderBy: { start_at: 'asc' },
          take: 10,
        }),

        // Upcoming Assignments
        this.prisma.assignment.findMany({
          where: {
            submission_date: { gt: now },
            class: {
              module: {
                course: {
                  enrollments: {
                    some: {
                      user_id: userId,
                      status: 'ACTIVE',
                    },
                  },
                },
              },
            },
          },
          select: {
            id: true,
            title: true,
            submission_date: true,
            total_marks: true,
            creator: {
              select: {
                name: true,
              },
            },
            class: {
              select: {
                module: {
                  select: {
                    course: {
                      select: {
                        title: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { submission_date: 'asc' },
          take: 10,
        }),

        // Upcoming Events
        this.prisma.event.findMany({
          where: {
            start_at: { gt: now },
          },
          select: {
            id: true,
            name: true,
            description: true,
            overview: true,
            start_at: true,
            time: true,
            location: true,
            amount_pence: true,
            creator: {
              select: {
                name: true,
              },
            },
            registrations: {
              where: { user_id: userId },
              select: {
                user_id: true,
              },
            },
          },
          orderBy: { start_at: 'asc' },
          take: 10,
        }),
      ]);

      const upcomingClass = rawClasses.map((c) => ({
        id: c.id,
        class_title: c.class_title,
        class_name: c.class_name,
        duration: c.duration,
        start_date: c.start_at,
        class_time: c.class_at,
        module_name: c.module?.module_name,
        module_title: c.module?.module_title,
        course_title: c.module?.course?.title,
        instructor_name: c.module?.course?.instructor?.name,
        materials: c.class_assets,
      }));

      const upcomingAssignment = rawAssignments.map((a) => ({
        id: a.id,
        title: a.title,
        due_date: a.submission_date,
        submission_date: a.submission_date,
        total_marks: a.total_marks,
        teacher_name: a.creator?.name,
        course_title: a.class?.module?.course?.title,
      }));

      const upcomingEvent = rawEvents.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        overview: e.overview,
        date: e.start_at,
        time: e.time,
        location: e.location,
        amount: e.amount_pence,
        creator_name: e.creator?.name,
        is_member: e.registrations.length > 0,
      }));

      return {
        userProfile,
        upcomingClass,
        upcomingAssignment,
        upcomingEvent,
      };
    } else {
      const rawCourses = await this.prisma.course.findMany({
        where: {
          start_date: { gt: now },
        },
        select: {
          id: true,
          title: true,
          fee_pence: true,
          duration: true,
          start_date: true,
          class_time: true,
          seat_capacity: true,
          instructor: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { start_date: 'asc' },
        take: 5,
      });

      const upcomingCourse = rawCourses.map((c) => ({
        id: c.id,
        title: c.title,
        fee: c.fee_pence,
        duration: c.duration,
        start_date: c.start_date,
        class_time: c.class_time,
        seat_capacity: c.seat_capacity,
        instructor_name: c.instructor?.name,
      }));

      return {
        userProfile,
        upcomingCourse,
      };
    }
  }
}
