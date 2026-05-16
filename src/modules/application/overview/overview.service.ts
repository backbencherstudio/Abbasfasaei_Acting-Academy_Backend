import { Injectable } from '@nestjs/common';
import { EnrollmentStep } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OverviewService {

  constructor(private readonly prisma: PrismaService) { }

  async getOverview(userId: string) {
    const [user, enrollment] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
      this.prisma.enrollment.findFirst({
        where: {
          user_id: userId,
          step: EnrollmentStep.COMPLETED,
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const userProfile = {
      name: user?.name || 'User',
    };

    const now = new Date();
    if (enrollment) {
      const [rawClasses, rawAssignments, rawEvents] = await Promise.all([
        // Upcoming Classes (strictly in the future)
        this.prisma.moduleClass.findFirst({
          where: {
            start_at: { gt: now },
            module: {
              course: {
                status: 'ACTIVE',
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
        }),

        // Upcoming Assignments (future due date AND not yet submitted)
        this.prisma.assignment.findFirst({
          where: {
            submission_date: { gt: now },
            submissions: {
              none: {
                student_id: userId,
                status: 'SUBMITTED',
              },
            },
            class: {
              module: {
                course: {
                  status: 'ACTIVE',
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
        }),

        // Upcoming Events (strictly in the future, next one only)
        this.prisma.event.findFirst({
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
        }),
      ]);

      const upcomingClasses = rawClasses
        ? {
          id: rawClasses.id,
          class_title: rawClasses.class_title,
          class_name: rawClasses.class_name,
          duration: rawClasses.duration,
          start_date: rawClasses.start_at,
          module_name: rawClasses.module?.module_name,
          module_title: rawClasses.module?.module_title,
          course_title: rawClasses.module?.course?.title,
          instructor_name: rawClasses.module?.course?.instructor?.name,
          materials: rawClasses.class_assets,
        }
        : null;

      const upcomingAssignments = rawAssignments
        ? {
          id: rawAssignments.id,
          title: rawAssignments.title,
          due_date: rawAssignments.submission_date,
          total_marks: rawAssignments.total_marks,
          teacher_name: rawAssignments.creator?.name,
          course_title: rawAssignments.class?.module?.course?.title,
        }
        : null;

      const upcomingEvents = rawEvents
        ? {
          id: rawEvents.id,
          name: rawEvents.name,
          description: rawEvents.description,
          overview: rawEvents.overview,
          date: rawEvents.start_at,
          time: rawEvents.time,
          location: rawEvents.location,
          amount: rawEvents.amount_pence,
          creator_name: rawEvents.creator?.name,
          is_member: rawEvents.registrations.length > 0,
        }
        : null;

      return {
        userProfile,
        upcomingClasses,
        upcomingAssignments,
        upcomingEvents,
      };
    } else {
      const [rawCourse, rawEvents] = await Promise.all([
        this.prisma.course.findFirst({
          where: {
            start_date: { gt: now },
            status: 'ACTIVE',
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
        }),
        // Upcoming Events for non-paid/new users (strictly in the future, next one only)
        this.prisma.event.findFirst({
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
        }),
      ]);

      const upcomingCourse = rawCourse
        ? {
          id: rawCourse.id,
          title: rawCourse.title,
          fee: rawCourse.fee_pence,
          duration: rawCourse.duration,
          start_date: rawCourse.start_date,
          class_time: rawCourse.class_time,
          seat_capacity: rawCourse.seat_capacity,
          instructor_name: rawCourse.instructor?.name,
        }
        : null;

      const upcomingEvents = rawEvents
        ? {
          id: rawEvents.id,
          name: rawEvents.name,
          description: rawEvents.description,
          overview: rawEvents.overview,
          date: rawEvents.start_at,
          time: rawEvents.time,
          location: rawEvents.location,
          amount: rawEvents.amount_pence,
          creator_name: rawEvents.creator?.name,
          is_member: rawEvents.registrations.length > 0,
        }
        : null;

      return {
        userProfile,
        upcomingCourse,
        upcomingEvents,
      };
    }
  }
}
