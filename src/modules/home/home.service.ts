import { Injectable } from '@nestjs/common';
import { EnrollmentStep } from '@prisma/client';
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
        where: {
          user_id: userId,
          step: EnrollmentStep.COMPLETED,
          IsPaymentCompleted: true,
        },
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
        this.prisma.moduleClass.findFirst({
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
        }),

        // Upcoming Assignments
        this.prisma.assignment.findFirst({
          where: {
            due_date: { gt: now },
            submissions: {
              none: {
                studentId: userId,
                submitted: true,
              },
            },
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
        }),

        // Upcoming Events
        this.prisma.event.findFirst({
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
        }),
      ]);

      const upcomingClasses = rawClasses
        ? {
            id: rawClasses.id,
            class_title: rawClasses.class_title,
            class_name: rawClasses.class_name,
            duration: rawClasses.duration,
            start_date: rawClasses.start_date,
            class_time: rawClasses.class_time,
            module_name: rawClasses.module?.module_name,
            module_title: rawClasses.module?.module_title,
            course_title: rawClasses.module?.course?.title,
            instructor_name: rawClasses.module?.course?.instructor?.name,
            materials: rawClasses.classAssets,
          }
        : null;

      const upcomingAssignments = rawAssignments
        ? {
            id: rawAssignments.id,
            title: rawAssignments.title,
            due_date: rawAssignments.due_date,
            submission_Date: rawAssignments.submission_Date,
            total_marks: rawAssignments.total_marks,
            teacher_name: rawAssignments.teacher?.name,
            course_title: rawAssignments.moduleClass?.module?.course?.title,
          }
        : null;

      const upcomingEvents = rawEvents
        ? {
            id: rawEvents.id,
            name: rawEvents.name,
            description: rawEvents.description,
            overview: rawEvents.overview,
            date: rawEvents.date,
            time: rawEvents.time,
            location: rawEvents.location,
            amount: rawEvents.amount,
            creator_name: rawEvents.creator?.name,
            is_member: rawEvents.members.length > 0,
          }
        : null;

      return {
        userProfile,
        upcomingClasses,
        upcomingAssignments,
        upcomingEvents,
      };
    } else {
      const rawCourse = await this.prisma.course.findFirst({
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
      });

      const upcomingCourse = rawCourse
        ? {
            id: rawCourse.id,
            title: rawCourse.title,
            fee: rawCourse.fee,
            duration: rawCourse.duration,
            start_date: rawCourse.start_date,
            class_time: rawCourse.class_time,
            seat_capacity: rawCourse.seat_capacity,
            instructor_name: rawCourse.instructor?.name,
          }
        : null;

      return {
        userProfile,
        upcomingCourse,
      };
    }
  }
}
