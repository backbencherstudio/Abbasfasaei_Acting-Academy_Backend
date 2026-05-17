import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EnrollmentStatus, EnrollmentStep } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) { }

  async getOverview(userId: string) {
    if (!userId) throw new UnauthorizedException("Please login first!!!")
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        user_id: userId,
        step: EnrollmentStep.COMPLETED,
        status: EnrollmentStatus.ACTIVE,
      },
      orderBy: { created_at: 'desc' },
    });

    if (enrollment) {
      return this.getEnrolledOverview(userId);
    }

    return this.getNotEnrolledOverview(userId);
  }

  private async getEnrolledOverview(userId: string) {
    const now = new Date();
    const classSelect = {
      id: true,
      class_title: true,
      class_name: true,
      start_at: true,
      end_at: true,
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
    } as const;

    const assignmentSelect = {
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
    } as const;

    const eventSelect = {
      id: true,
      name: true,
      description: true,
      start_at: true,
      time: true,
      location: true,
      registrations: {
        where: { user_id: userId },
        select: {
          user_id: true,
        },
      },
    } as const;

    const enrolledCourseWhere = {
      status: 'ACTIVE' as const,
      enrollments: {
        some: {
          user_id: userId,
          status: 'ACTIVE' as const,
        },
      },
    };

    const mapClass = (rawClass: any) =>
      rawClass
        ? {
          id: rawClass.id,
          class_title: rawClass.class_title,
          class_name: rawClass.class_name,
          start_at: rawClass.start_at,
          end_at: rawClass.end_at,
          module_name: rawClass.module?.module_name,
          module_title: rawClass.module?.module_title,
          course_title: rawClass.module?.course?.title,
          instructor_name: rawClass.module?.course?.instructor?.name,
        }
        : null;

    const mapAssignment = (rawAssignment: any) =>
      rawAssignment
        ? {
          id: rawAssignment.id,
          title: rawAssignment.title,
          due_date: rawAssignment.submission_date,
          total_marks: rawAssignment.total_marks,
          teacher_name: rawAssignment.creator?.name,
          course_title: rawAssignment.class?.module?.course?.title,
          due_days: Math.ceil(
            (new Date(rawAssignment.submission_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
          ) > 0
            ? Math.ceil(
              (new Date(rawAssignment.submission_date).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
            )
            : null,
        }
        : null;

    const mapEvent = (rawEvent: any) =>
      rawEvent
        ? {
          id: rawEvent.id,
          name: rawEvent.name,
          description: rawEvent.description,
          date: rawEvent.start_at,
          time: rawEvent.time,
          location: rawEvent.location,
          is_member: rawEvent.registrations.length > 0,
        }
        : null;

    const [
      startedClasses,
      nextClass,
      lastClass,
      nextAssignment,
      lastAssignment,
      rawEvent,
    ] = await Promise.all([
      this.prisma.moduleClass.findMany({
        where: {
          start_at: { lte: now },
          module: {
            course: enrolledCourseWhere,
          },
        },
        select: classSelect,
        orderBy: { start_at: 'desc' },
        take: 10,
      }),
      this.prisma.moduleClass.findFirst({
        where: {
          start_at: { gt: now },
          module: {
            course: enrolledCourseWhere,
          },
        },
        select: classSelect,
        orderBy: { start_at: 'asc' },
      }),
      this.prisma.moduleClass.findFirst({
        where: {
          start_at: { lte: now },
          module: {
            course: enrolledCourseWhere,
          },
        },
        select: classSelect,
        orderBy: { start_at: 'desc' },
      }),
      this.prisma.assignment.findFirst({
        where: {
          submission_date: { gt: now },
          class: {
            module: {
              course: enrolledCourseWhere,
            },
          },
        },
        select: assignmentSelect,
        orderBy: { submission_date: 'asc' },
      }),
      this.prisma.assignment.findFirst({
        where: {
          submission_date: { lte: now },
          class: {
            module: {
              course: enrolledCourseWhere,
            },
          },
        },
        select: assignmentSelect,
        orderBy: { submission_date: 'desc' },
      }),
      this.prisma.event.findFirst({
        where: {
          start_at: { gt: now },
        },
        select: eventSelect,
        orderBy: { start_at: 'asc' },
      }),
    ]);

    const ongoingClass =
      startedClasses.find((classItem) => {
        if (!classItem.start_at) return false;
        if (!classItem.end_at) return true;

        const startTime = new Date(classItem.start_at);
        const endTime = new Date(classItem.end_at);

        return startTime <= now && endTime >= now;
      }) || null;

    const selectedClass = ongoingClass || nextClass || lastClass || null;
    const selectedAssignment = nextAssignment || lastAssignment || null;

    return {
      success: true,
      message: 'Overview fetched successfully',
      data: {
        upcoming_classes: mapClass(selectedClass),
        upcoming_assignments: mapAssignment(selectedAssignment),
        upcoming_events: mapEvent(rawEvent),
      },
    };
  }

  private async getNotEnrolledOverview(userId: string) {
    const now = new Date();
    const eventSelect = {
      id: true,
      name: true,
      description: true,
      start_at: true,
      time: true,
      location: true,
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
    } as const;
    const mapEvent = (rawEvent: any) =>
      rawEvent
        ? {
          id: rawEvent.id,
          name: rawEvent.name,
          description: rawEvent.description,
          date: rawEvent.start_at,
          time: rawEvent.time,
          location: rawEvent.location,
          creator_name: rawEvent.creator?.name,
          is_member: rawEvent.registrations.length > 0,
        }
        : null;

    const [rawCourse, rawEvent] = await Promise.all([
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
      this.prisma.event.findFirst({
        where: {
          start_at: { gt: now },
        },
        select: eventSelect,
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

    return {
      success: true,
      message: 'Overview fetched successfully',
      data: {
        upcoming_course: upcomingCourse,
        upcoming_events: mapEvent(rawEvent),
      },
    };
  }
}
