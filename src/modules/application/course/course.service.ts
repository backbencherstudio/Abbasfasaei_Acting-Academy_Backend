import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';
import { EnrollmentStep } from '@prisma/client';
import { EnrollmentService } from './enrollment.helper';
import { AttendanceService } from './attendance.helper';

@Injectable()
export class CourseService {
  private readonly enrollmentService: EnrollmentService;
  private readonly attendanceService: AttendanceService;

  constructor(private prisma: PrismaService) {
    this.enrollmentService = new EnrollmentService(prisma);
    this.attendanceService = new AttendanceService(prisma);
  }

  getEnrollmentCourses() {
    return this.enrollmentService.getAllCourses();
  }

  getCurrentStep(userId: string, courseId: string) {
    return this.enrollmentService.getCurrentStep(userId, courseId);
  }

  enrollUser(userId: string, courseId: string, dto: any) {
    return this.enrollmentService.enrollUser(userId, courseId, dto);
  }

  acceptRules(userId: string, enrollmentId: string, dto: any) {
    return this.enrollmentService.acceptRules(userId, enrollmentId, dto);
  }

  acceptContract(userId: string, enrollmentId: string, dto: any) {
    return this.enrollmentService.acceptContract(userId, enrollmentId, dto);
  }

  myEnrollmentCourses(userId: string) {
    return this.enrollmentService.myCourses(userId);
  }

  scanQr(token: string, userId: string) {
    return this.attendanceService.qrscanner(token, userId);
  }

  async getAllCourses() {
    try {
      const courses = await this.prisma.course.findMany({
        orderBy: { created_at: 'desc' },
        select: { id: true, title: true, course_overview: true },
      });
      return { success: true, data: courses };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching courses');
    }
  }

  async getMyCourses(userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      // 1) Fetch my courses with modules
      const myCoursesRaw = await this.prisma.course.findMany({
        where: {
          enrollments: {
            some: {
              user_id: userId,
              step: EnrollmentStep.COMPLETED,
              IsPaymentCompleted: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        include: {
          modules: {
            select: {
              id: true,
              module_title: true,
              module_name: true,
              classes: { select: { id: true } },
            },
          },
        },
      });

      const myCourseIds = myCoursesRaw.map((c) => c.id);

      // 3) Compute total classes per course
      const totalClassesByCourse: Record<string, number> = {};
      for (const c of myCoursesRaw) {
        const total = c.modules.reduce(
          (sum, m) => sum + (m.classes?.length || 0),
          0,
        );
        totalClassesByCourse[c.id] = total;
      }

      // 4) Compute attended (present) classes per course for this user
      const attended = await this.prisma.attendance.findMany({
        where: {
          student_id: userId,
          status: 'PRESENT',
          class: { module: { courseId: { in: myCourseIds } } },
        },
        select: {
          id: true,
          class: { select: { module: { select: { courseId: true } } } },
        },
      });
      const attendedByCourse: Record<string, number> = {};
      for (const a of attended) {
        const cid = a.class.module.courseId;
        attendedByCourse[cid] = (attendedByCourse[cid] || 0) + 1;
      }

      // 5) Shape my courses for UI (progress, summary)
      const myCourses = myCoursesRaw.map((c) => {
        const modulesCount = c.modules.length;
        const totalClasses = totalClassesByCourse[c.id] || 0;
        const attendedCount = attendedByCourse[c.id] || 0;
        const progress =
          totalClasses > 0
            ? Math.round((attendedCount / totalClasses) * 100)
            : 0;
        const scheduleLabel = c.class_time
          ? `${c.class_time} lessons`
          : c.duration
            ? `${c.duration}`
            : 'Flexible schedule';
        const infoLine = `${scheduleLabel}, ${modulesCount} module${modulesCount === 1 ? '' : 's'}.`;

        return {
          id: c.id,
          title: c.title,
          course_overview: c.course_overview,
          modulesCount,
          totalClasses,
          attendedClasses: attendedCount,
          progressPercent: progress,
          progressLabel: `Progress : ${progress}%`,
          infoLine,
        };
      });

      // 6) Others courses (not enrolled)
      const otherCoursesRaw = await this.prisma.course.findMany({
        where: myCourseIds.length ? { id: { notIn: myCourseIds } } : {},
        orderBy: { created_at: 'desc' },
        include: {
          _count: { select: { modules: true } },
        },
      });

      const otherCourses = otherCoursesRaw.map((c) => {
        const modulesCount = (c as any)._count?.modules ?? 0;
        const scheduleLabel = c.class_time
          ? `${c.class_time} lessons`
          : c.duration
            ? `${c.duration}`
            : 'Flexible schedule';
        const infoLine = `${scheduleLabel}, ${modulesCount} module${modulesCount === 1 ? '' : 's'}.`;

        return {
          id: c.id,
          title: c.title,
          course_overview: c.course_overview,
          modulesCount,
          infoLine,
        };
      });

      return {
        success: true,
        data: {
          myCourses,
          otherCourses,
        },
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching my courses');
    }
  }

  async getCourseDetails(courseId: string, userId: string) {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        include: {
          // We don't need full class payload for the details card; keep it light
          modules: {
            select: {
              id: true,
              module_title: true,
              module_name: true,
              // keep classes count only if needed later
              _count: { select: { classes: true } },
            },
          },
          instructor: {
            select: { id: true, name: true, avatar: true, about: true },
          },
        },
      });

      if (!course) {
        return { success: false, message: 'Course not found' };
      }

      const isEnrolled = await this.prisma.enrollment.findFirst({
        where: { courseId, user_id: userId },
      });

      // Derive UI-friendly fields
      const startDate = course.start_date ? new Date(course.start_date) : null;
      const dayOfWeek = startDate
        ? startDate.toLocaleDateString('en-US', { weekday: 'long' })
        : null;
      const timeLabel = course.class_time
        ? course.class_time
        : startDate
          ? startDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
          : null;
      const scheduleLabel =
        dayOfWeek && timeLabel
          ? `Every ${dayOfWeek} ${timeLabel}`
          : dayOfWeek
            ? `Every ${dayOfWeek}`
            : timeLabel || 'Flexible schedule';

      // Modules mapping
      const modules = (course.modules || []).map((m: any) => ({
        id: m.id,
        module_title: m.module_title,
        module_name: m.module_name,
        classesCount: m?._count?.classes ?? 0,
      }));
      const modulesCount = modules.length;
      const modulesList = modules
        .map((m) => m.module_title ?? m.module_name)
        .filter(Boolean);

      // Extract overview text and includes from JSON blobs with safe fallbacks
      const normalizeToText = (j: unknown): string | null => {
        if (!j) return null;
        if (typeof j === 'string') return j;
        try {
          const obj = j as any;
          // common keys that might hold the paragraph
          const text =
            obj?.overview ||
            obj?.summary ||
            obj?.description ||
            obj?.text ||
            null;
          return typeof text === 'string' ? text : null;
        } catch {
          return null;
        }
      };

      const overviewText =
        normalizeToText(course.course_overview) ??
        `This course runs on a ${dayOfWeek ?? 'flexible'} schedule.`;

      const pullIncludes = (j: unknown): string[] => {
        try {
          const obj = j as any;
          const inc = obj?.includes;
          if (Array.isArray(inc))
            return inc.filter((x) => typeof x === 'string');
          return [];
        } catch {
          return [];
        }
      };

      const includes: string[] = [
        ...pullIncludes(course.course_module_details),
        ...pullIncludes(course.course_overview),
        ...pullIncludes(course.installment_process),
      ];

      // De-duplicate includes while preserving order
      const seen = new Set<string>();
      const uniqueIncludes = includes.filter((x) => {
        if (seen.has(x)) return false;
        seen.add(x);
        return true;
      });

      return {
        success: true,
        data: {
          ...course,
          isEnrolled: !!isEnrolled,
          // UI helpers
          schedule: {
            day: dayOfWeek,
            time: timeLabel,
            label: scheduleLabel,
          },
          scheduleLabel,
          modulesCount,
          modules,
          modulesList,
          overviewText,
          includes: uniqueIncludes,
        },
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching course details');
    }
  }

  async getMyCourseDetails(courseId: string, userId: string) {
    try {
      if (!userId) {
        return { success: false, message: 'User ID is required' };
      }

      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          courseId: courseId,
          user_id: userId,
          step: EnrollmentStep.COMPLETED,
          IsPaymentCompleted: true,
        },
      });

      if (!enrollment) {
        return { success: false, message: 'Enrollment not found' };
      }

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        include: {
          modules: {
            select: { id: true, module_title: true, module_name: true },
          },
          instructor: {
            select: { id: true, name: true, avatar: true, about: true },
          },
        },
      });

      if (!course) {
        return { success: false, message: 'Course not found' };
      }

      const nextClass = await this.prisma.moduleClass.findFirst({
        where: {
          module: { courseId: courseId },
          start_date: { gt: new Date() },
        },
        orderBy: { start_date: 'asc' },
        select: {
          id: true,
          class_title: true,
          class_name: true,
          class_overview: true,
          duration: true,
          start_date: true,
          class_time: true,
          moduleId: true,
        },
      });

      return {
        success: true,
        data: { ...course, nextClass, isEnrolled: !!enrollment },
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error fetching my course details',
      );
    }
  }

  async getModuleDetails(moduleId: string, userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const module = await this.prisma.courseModule.findUnique({
        where: { id: moduleId },
        include: {
          classes: {
            orderBy: { start_date: 'asc' },
            select: {
              id: true,
              class_title: true,
              class_name: true,
            },
          },
        },
      });

      if (!module) {
        return { success: false, message: 'Module not found' };
      }

      return { success: true, data: module };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching module details');
    }
  }

  async getClassDetails(classId: string, userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }
      const classDetails = await this.prisma.moduleClass.findUnique({
        where: { id: classId },
        include: {
          assignments: {
            select: {
              id: true,
              title: true,
              due_date: true,
              grades: true,
              submissions: {
                where: { studentId: userId },
                select: {
                  id: true,
                  submittedAt: true,
                  grade: {
                    select: {
                      id: true,
                      grade: true,
                      grade_number: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          classAssets: {
            select: {
              id: true,
              asset_type: true,
              asset_url: true,
            },
            orderBy: { created_at: 'asc' },
          },
        },
      });

      if (!classDetails) {
        return { success: false, message: 'Class not found' };
      }
      const fileNameFromUrl = (url: string) => {
        try {
          const parts = url.split('?')[0].split('#')[0].split('/');
          return parts[parts.length - 1] || url;
        } catch {
          return url;
        }
      };

      const videos = classDetails.classAssets
        .filter((a) => a.asset_type === 'VIDEO')
        .map((a) => ({
          id: a.id,
          asset_url: a.asset_url,
          file_name: fileNameFromUrl(a.asset_url),
        }));

      const pdfs = classDetails.classAssets
        .filter((a) => a.asset_type === 'FILE')
        .map((a) => ({
          id: a.id,
          asset_url: a.asset_url,
          file_name: fileNameFromUrl(a.asset_url),
        }));

      const now = new Date();
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      const formattedClassDetails = {
        ...classDetails,
        assignments: classDetails.assignments.map((a) => {
          const submission = a.submissions[0];
          const gradeData = submission?.grade || a.grades[0];
          const status = gradeData
            ? 'GRADED'
            : submission
              ? 'SUBMITTED'
              : 'PENDING';

          let due_in_days: number | null = null;
          let due_label: string | null = null;
          let is_overdue = false;

          if (a.due_date) {
            const diff = (a.due_date as Date).getTime() - now.getTime();
            const days = Math.ceil(diff / MS_PER_DAY);
            if (days > 0 && status === 'PENDING') {
              due_in_days = days;
              due_label = `Due ${days} day${days === 1 ? '' : 's'}`;
            } else if (days <= 0) {
              is_overdue = status === 'PENDING';
            }
          }
          delete a.submissions;
          delete a.grades;
          return {
            id: a.id,
            title: a.title,
            due_date: a.due_date,
            grade: gradeData,
            status,
            due_in_days,
            due_label,
            is_overdue,
          };
        }),
        classAssets: {
          videos,
          pdfs,
        },
      };

      return { success: true, data: formattedClassDetails };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching class details');
    }
  }

  async getAssignmentsForCourse(courseId: string, userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      if (!courseId) {
        return {
          success: false,
          message: 'Course ID is required',
        };
      }

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        return {
          success: false,
          message: 'Course not found',
        };
      }

      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          courseId,
          user_id: userId,
        },
      });

      if (!enrollment) {
        return {
          success: false,
          message: 'You are not enrolled in this course',
        };
      }

      // Fetch modules with their classes, assignments, and the user's submissions/grades in a single query
      const modules = await this.prisma.courseModule.findMany({
        where: { courseId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          module_title: true,
          module_name: true,
          classes: {
            select: {
              id: true,
              class_title: true,
              class_name: true,
              assignments: {
                select: {
                  id: true,
                  title: true,
                  due_date: true,
                  submissions: {
                    where: { studentId: userId },
                    select: {
                      submittedAt: true,
                      grade: { select: { grade: true, grade_number: true } },
                    },
                  },
                  grades: {
                    where: { studentId: userId },
                    select: { grade: true, grade_number: true },
                  },
                },
              },
            },
          },
        },
      });

      const now = new Date();
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      const grouped = modules
        .map((m) => {
          const assignments: any[] = [];

          m.classes.forEach((c) => {
            c.assignments.forEach((a) => {
              const submission = a.submissions[0];
              const gradeData = submission?.grade || a.grades[0];
              const status = gradeData
                ? 'GRADED'
                : submission
                  ? 'SUBMITTED'
                  : 'PENDING';

              let due_in_days: number | null = null;
              let due_label: string | null = null;
              let is_overdue = false;

              if (a.due_date) {
                const diff = (a.due_date as Date).getTime() - now.getTime();
                const days = Math.ceil(diff / MS_PER_DAY);
                if (days > 0 && status === 'PENDING') {
                  due_in_days = days;
                  due_label = `Due ${days} day${days === 1 ? '' : 's'}`;
                } else if (days <= 0) {
                  is_overdue = status === 'PENDING';
                }
              }

              assignments.push({
                id: a.id,
                title: a.title,
                class_id: c.id,
                class_title: c.class_title,
                class_name: c.class_name,
                module_id: m.id,
                module_title: m.module_title,
                module_name: m.module_name,
                due_date: a.due_date,
                due_in_days,
                due_label,
                is_overdue,
                submitted: !!submission,
                submittedAt: submission?.submittedAt ?? null,
                grade: gradeData?.grade ?? null,
                grade_number: gradeData?.grade_number ?? null,
                status,
              });
            });
          });

          return {
            module_id: m.id,
            module_title: m.module_title,
            module_name: m.module_name,
            assignments: assignments.sort((x, y) => {
              const dx = x.due_date ? (x.due_date as Date).getTime() : 0;
              const dy = y.due_date ? (y.due_date as Date).getTime() : 0;
              return dx - dy;
            }),
          };
        })
        .filter((m) => m.assignments.length > 0);

      return { success: true, data: grouped };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching assignments');
    }
  }

  async getAssignmentDetails(assignmentId: string, userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          moduleClass: {
            select: {
              id: true,
              class_title: true,
              class_name: true,
              module: {
                select: {
                  id: true,
                  module_title: true,
                  module_name: true,
                  createdAt: true,
                },
              },
            },
          },
          submissions: {
            where: { studentId: userId },
            select: {
              id: true,
              title: true,
              description: true,
              fileUrl: true,
              submittedAt: true,
              grade: { select: { id: true, grade: true, grade_number: true } },
            },
          },
        },
      });

      if (!assignment) {
        return { success: false, message: 'Assignment not found' };
      }

      const submission = assignment.submissions?.[0] || null;
      const status = submission?.grade
        ? 'GRADED'
        : submission
          ? 'SUBMITTED'
          : 'NOT_SUBMITTED';

      const formattedAssignment = {
        ...assignment,
        status,
        submission,
      };

      delete formattedAssignment.submissions;

      return { success: true, data: formattedAssignment };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error fetching assignment details',
      );
    }
  }

  async submitAssignment(
    assignmentId: string,
    userId: string,
    submitDto: any,
    files: Express.Multer.File[],
    mediaType?: 'PHOTO' | 'VIDEO' | 'FILE',
  ) {
    try {
      let mediaUrls: string[] = [];

      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      // Check if the assignment exists
      const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
      });
      if (!assignment) {
        return {
          success: false,
          message: 'Assignment not found',
        };
      }

      // already submitted?
      const existingSubmission =
        await this.prisma.assignmentSubmission.findFirst({
          where: { assignmentId, studentId: userId },
        });

      if (existingSubmission) {
        return {
          success: false,
          message: 'Assignment already submitted',
        };
      }

      if (files && files.length > 0) {
        for (const file of files) {
          const filename = `${StringHelper.randomString(10)}_${file.originalname}`;

          const derivedType: 'PHOTO' | 'VIDEO' | 'FILE' = mediaType
            ? mediaType
            : file.mimetype?.startsWith('image/')
              ? 'PHOTO'
              : file.mimetype?.startsWith('video/')
                ? 'VIDEO'
                : 'FILE';

          let basePath: string;
          if (derivedType === 'PHOTO') {
            basePath = appConfig().storageUrl.communityPhoto;
          } else if (derivedType === 'VIDEO') {
            basePath = appConfig().storageUrl.communityVideo;
          } else {
            basePath = appConfig().storageUrl.attachment;
          }

          await SazedStorage.put(`${basePath}/${filename}`, file.buffer);

          const publicUrl =
            process.env.AWS_S3_ENDPOINT +
            '/' +
            process.env.AWS_S3_BUCKET +
            basePath +
            `/${filename}`;

          mediaUrls.push(publicUrl);
        }
      }

      // Create a submission
      const submission = await this.prisma.assignmentSubmission.create({
        data: {
          assignmentId,
          studentId: userId,
          title: submitDto.title,
          description: submitDto.description,
          fileUrl: mediaUrls.length > 0 ? mediaUrls[0] : null,
          submittedAt: new Date(),
        },
        select: {
          id: true,
          assignmentId: true,
          studentId: true,
          title: true,
          description: true,
          fileUrl: true,
          submittedAt: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        message: 'Assignment submitted successfully',
        data: submission,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error submitting assignment');
    }
  }

  async getAllAssetsFromCourse(courseId: string, userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      if (!courseId) {
        return {
          success: false,
          message: 'Course ID is required',
        };
      }

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        return {
          success: false,
          message: 'Course not found',
        };
      }

      // Ensure the user is enrolled in this course
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { courseId, user_id: userId },
      });
      if (!enrollment) {
        return {
          success: false,
          message: 'You are not enrolled in this course',
        };
      }

      // Fetch modules with classes and their assets for the given course
      const modules = await this.prisma.courseModule.findMany({
        where: { courseId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          module_title: true,
          module_name: true,
          classes: {
            orderBy: { start_date: 'asc' },
            select: {
              id: true,
              class_title: true,
              class_name: true,
              classAssets: {
                select: { id: true, asset_type: true, asset_url: true },
              },
            },
          },
        },
      });

      // Helper to extract a filename-like label from URL
      const fileNameFromUrl = (url: string) => {
        try {
          const parts = url.split('?')[0].split('#')[0].split('/');
          return parts[parts.length - 1] || url;
        } catch {
          return url;
        }
      };

      // Build grouped responses per type
      const videos = modules.map((m) => ({
        module_id: m.id,
        module_title: m.module_title,
        module_name: m.module_name,
        assets: m.classes.flatMap((c) =>
          c.classAssets
            .filter((a) => a.asset_type === 'VIDEO')
            .map((a) => ({
              id: a.id,
              class_id: c.id,
              class_title: c.class_title,
              class_name: c.class_name,
              asset_url: a.asset_url,
              file_name: fileNameFromUrl(a.asset_url),
            })),
        ),
      }));

      const pdfs = modules.map((m) => ({
        module_id: m.id,
        module_title: m.module_title,
        module_name: m.module_name,
        assets: m.classes.flatMap((c) =>
          c.classAssets
            .filter((a) => a.asset_type === 'FILE')
            .map((a) => ({
              id: a.id,
              class_id: c.id,
              class_title: c.class_title,
              class_name: c.class_name,
              asset_url: a.asset_url,
              file_name: fileNameFromUrl(a.asset_url),
            })),
        ),
      }));

      return { success: true, data: { videos, pdfs } };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching course assets');
    }
  }

  async getAssignmentsForClass(userId: string, classId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const existingClass = await this.prisma.moduleClass.findUnique({
        where: { id: classId },
      });

      if (!existingClass) {
        return { message: 'Class not found', success: false };
      }

      const assignments = await this.prisma.assignment.findMany({
        where: { moduleClassId: classId },
        select: {
          id: true,
          title: true,
          description: true,
          submission_Date: true,
          due_date: true,
          moduleClassId: true,
          _count: {
            select: {
              submissions: true,
              grades: true,
            },
          },
        },
      });

      const formattedAssignments = assignments.map((assignment) => {
        const total_submissions = assignment._count.submissions;
        const total_graded = assignment._count.grades;
        delete assignment._count;

        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          submission_Date: assignment.submission_Date,
          due_date: assignment.due_date,
          class_id: assignment.moduleClassId,
          submissions: total_submissions,
          grades: total_graded,
        };
      });

      return {
        message: 'Assignments retrieved successfully',
        success: true,
        data: formattedAssignments,
      };
    } catch (error) {
      console.error('Error retrieving assignments:', error);
      throw new Error('Could not retrieve assignments');
    }
  }

  async getAllAssets(classId: string, userId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const existingClass = await this.prisma.moduleClass.findUnique({
        where: { id: classId },
      });

      if (!existingClass) {
        return { message: 'Class not found', success: false };
      }

      const assets = await this.prisma.classAsset.findMany({
        where: { class_id: classId },
        select: {
          id: true,
          asset_type: true,
          asset_url: true,
          created_at: true,
          updated_at: true,
        },
      });

      const fileNameFromUrl = (url: string) => {
        try {
          const parts = url.split('?')[0].split('#')[0].split('/');
          return parts[parts.length - 1] || url;
        } catch {
          return url;
        }
      };

      const videos = assets
        .filter((a) => a.asset_type === 'VIDEO')
        .map((a) => {
          return {
            id: a.id,
            asset_url: a.asset_url,
            file_name: fileNameFromUrl(a.asset_url),
          };
        });

      const files = assets
        .filter((a) => a.asset_type === 'FILE')
        .map((a) => {
          return {
            id: a.id,
            asset_url: a.asset_url,
            file_name: fileNameFromUrl(a.asset_url),
          };
        });

      return {
        message: 'Class assets fetched successfully',
        success: true,
        data: {
          videos,
          files,
        },
      };
    } catch (error) {
      console.error('Error fetching class assets:', error);
      throw new Error('Could not fetch class assets');
    }
  }
}
