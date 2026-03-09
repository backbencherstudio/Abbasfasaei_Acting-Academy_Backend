import { Injectable } from '@nestjs/common';
// import { PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class HomeService {
  constructor(private prisma: PrismaService) {}

  // async getHome(userId: string) {
  //   const enrollmentStatus = await this.prisma.enrollment.findUnique({
  //     where: {
  //       id: userId,
  //     },
  //   });

  //   const now = new Date();
  //   if (enrollmentStatus?.IsPaymentCompleted) {
  //     const [upcomingClasses, upcomingAssignments, upcomingEvents] =
  //       await Promise.all([
  //         // Upcoming Classes
  //         this.prisma.moduleClass.findMany({
  //           where: {
  //             start_date: { gt: now },
  //             module: {
  //               course: {
  //                 enrollments: {
  //                   some: {
  //                     user_id: userId,
  //                     status: 'ACTIVE',
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //           select: {
  //             id: true,
  //             class_title: true,
  //             class_name: true,
  //             duration: true,
  //             start_date: true,
  //             class_time: true,
  //             module: {
  //               select: {
  //                 course: {
  //                   select: {
  //                     fee: true,
  //                     instructor: {
  //                       select: {
  //                         id: true,
  //                         name: true,
  //                       },
  //                     },
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //           orderBy: { start_date: 'asc' },
  //           take: 10,
  //         }),

  //         // Upcoming Assignments
  //         this.prisma.assignment.findMany({
  //           where: {
  //             due_date: { gt: now },
  //             moduleClass: {
  //               module: {
  //                 course: {
  //                   enrollments: {
  //                     some: {
  //                       user_id: userId,
  //                       status: 'ACTIVE',
  //                     },
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //           select: {
  //             id: true,
  //             title: true,
  //             due_date: true,
  //             submission_Date: true,
  //             total_marks: true,
  //             teacher: {
  //               select: {
  //                 id: true,
  //                 name: true,
  //               },
  //             },
  //           },
  //           orderBy: { due_date: 'asc' },
  //           take: 10,
  //         }),

  //         // Upcoming Courses
  //         this.prisma.course.findMany({
  //           where: {
  //             start_date: { gt: now },
  //             enrollments: {
  //               some: {
  //                 user_id: userId,
  //                 status: 'ACTIVE',
  //               },
  //             },
  //           },
  //           select: {
  //             id: true,
  //             title: true,
  //             fee: true,
  //             duration: true,
  //             start_date: true,
  //             class_time: true,
  //             seat_capacity: true,
  //             instructor: {
  //               select: {
  //                 id: true,
  //                 name: true,
  //               },
  //             },
  //           },
  //           orderBy: { start_date: 'asc' },
  //           take: 5,
  //         }),

  //         // Upcoming Events
  //         this.prisma.event.findMany({
  //           where: {
  //             date: { gt: now },
  //           },
  //           select: {
  //             id: true,
  //             name: true,
  //             description: true,
  //             overview: true,
  //             date: true,
  //             time: true,
  //             location: true,
  //             amount: true,
  //             creator: {
  //               select: {
  //                 id: true,
  //                 name: true,
  //               },
  //             },
  //             members: {
  //               where: { user_id: userId },
  //               select: {
  //                 user_id: true,
  //               },
  //             },
  //           },
  //           orderBy: { date: 'asc' },
  //           take: 10,
  //         }),
  //       ]);

  //     return {
  //       upcomingClasses,
  //       upcomingAssignments,
  //       upcomingEvents,
  //     };
  //   } else {
  //     const upcomingCourses = this.prisma.course.findMany({
  //       where: {
  //         start_date: { gt: now },
  //         enrollments: {
  //           some: {
  //             user_id: userId,
  //             status: 'ACTIVE',
  //           },
  //         },
  //       },
  //       select: {
  //         id: true,
  //         title: true,
  //         fee: true,
  //         duration: true,
  //         start_date: true,
  //         class_time: true,
  //         seat_capacity: true,
  //         instructor: {
  //           select: {
  //             id: true,
  //             name: true,
  //           },
  //         },
  //       },
  //       orderBy: { start_date: 'asc' },
  //       take: 5,
  //     });

  //     const upcomingEvents = // Upcoming Events
  //       this.prisma.event.findMany({
  //         where: {
  //           date: { gt: now },
  //         },
  //         select: {
  //           id: true,
  //           name: true,
  //           description: true,
  //           overview: true,
  //           date: true,
  //           time: true,
  //           location: true,
  //           amount: true,
  //           creator: {
  //             select: {
  //               id: true,
  //               name: true,
  //             },
  //           },
  //           members: {
  //             where: { user_id: userId },
  //             select: {
  //               user_id: true,
  //             },
  //           },
  //         },
  //         orderBy: { date: 'asc' },
  //         take: 10,
  //       });

  //     return {
  //       upcomingCourses,
  //       upcomingEvents,
  //     };
  //   }
  // }
  async getHome(userId: string) {
    const [user, enrollment] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, first_name: true, last_name: true },
      }),
      this.prisma.enrollment.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const userProfile = {
      name:
        user?.name ||
        `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
        'User',
    };

    const now = new Date();
    if (enrollment?.IsPaymentCompleted) {
      const [rawClasses, rawAssignments, rawEvents] = await Promise.all([
        // Upcoming Classes
        this.prisma.moduleClass.findMany({
          where: {
            start_date: { gt: now },
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
            start_date: true,
            class_time: true,
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
            classAssets: {
              select: {
                id: true,
                asset_type: true,
                asset_url: true,
              },
            },
          },
          orderBy: { start_date: 'asc' },
          take: 10,
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
            due_date: true,
            submission_Date: true,
            total_marks: true,
            teacher: {
              select: {
                name: true,
              },
            },
            moduleClass: {
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
          orderBy: { due_date: 'asc' },
          take: 10,
        }),

        // Upcoming Events
        this.prisma.event.findMany({
          where: {
            date: { gt: now },
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
                name: true,
              },
            },
            members: {
              where: { user_id: userId },
              select: {
                user_id: true,
              },
            },
          },
          orderBy: { date: 'asc' },
          take: 10,
        }),
      ]);

      const upcomingClasses = rawClasses.map((c) => ({
        id: c.id,
        class_title: c.class_title,
        class_name: c.class_name,
        duration: c.duration,
        start_date: c.start_date,
        class_time: c.class_time,
        module_name: c.module?.module_name,
        module_title: c.module?.module_title,
        course_title: c.module?.course?.title,
        instructor_name: c.module?.course?.instructor?.name,
        materials: c.classAssets,
      }));

      const upcomingAssignments = rawAssignments.map((a) => ({
        id: a.id,
        title: a.title,
        due_date: a.due_date,
        submission_Date: a.submission_Date,
        total_marks: a.total_marks,
        teacher_name: a.teacher?.name,
        course_title: a.moduleClass?.module?.course?.title,
      }));

      const upcomingEvents = rawEvents.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        overview: e.overview,
        date: e.date,
        time: e.time,
        location: e.location,
        amount: e.amount,
        creator_name: e.creator?.name,
        is_member: e.members.length > 0,
      }));

      return {
        userProfile,
        upcomingClasses,
        upcomingAssignments,
        upcomingEvents,
      };
    } else {
      const rawCourses = await this.prisma.course.findMany({
        where: {
          start_date: { gt: now },
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
              name: true,
            },
          },
        },
        orderBy: { start_date: 'asc' },
        take: 5,
      });

      const upcomingCourses = rawCourses.map((c) => ({
        id: c.id,
        title: c.title,
        fee: c.fee,
        duration: c.duration,
        start_date: c.start_date,
        class_time: c.class_time,
        seat_capacity: c.seat_capacity,
        instructor_name: c.instructor?.name,
      }));

      return {
        userProfile,
        upcomingCourses,
      };
    }
  }
}
