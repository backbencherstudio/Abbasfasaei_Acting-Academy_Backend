import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SazedStorage } from 'src/common/lib/disk/SazedStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

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

      const enrollments = await this.prisma.enrollment.findMany({
        where: { user_id: userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              course_overview: true,
              modules: true,
            },
          },
        },
      });
      return { success: true, data: enrollments.map((e) => e.course) };
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
          modules: { include: { classes: true } },
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

      return { success: true, data: { ...course, isEnrolled: !!isEnrolled } };
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
        where: { courseId: courseId, user_id: userId },
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
            },
          },
          classAssets: {
            select: {
              id: true,
              asset_type: true,
            },
          },
        },
      });

      if (!classDetails) {
        return { success: false, message: 'Class not found' };
      }
      return { success: true, data: classDetails };
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

      // Pull assignments along with their class and module metadata
      const assignments = await this.prisma.assignment.findMany({
        where: enrollment?.courseModuleId
          ? { moduleClass: { moduleId: enrollment.courseModuleId } }
          : { moduleClass: { module: { courseId } } },
        orderBy: { due_date: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          due_date: true,
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
        },
      });

      const assignmentIds = assignments.map((a) => a.id);

      const [userSubmissions, userGrades] = await Promise.all([
        await this.prisma.assignmentSubmission.findMany({
          where: { assignmentId: { in: assignmentIds }, studentId: userId },
          select: {
            assignmentId: true,
            id: true,
            submitted: true,
            submittedAt: true,
            grade: { select: { id: true, grade: true, grade_number: true } },
          },
        }),
        await this.prisma.assignmentGrade.findMany({
          where: { assignmentId: { in: assignmentIds }, studentId: userId },
          select: {
            assignmentId: true,
            id: true,
            grade: true,
            grade_number: true,
          },
        }),
      ]);

      const subByAssignment = new Map<
        string,
        {
          id: string;
          submittedAt: Date;
          grade?: { id: string; grade: string; grade_number: number } | null;
        }
      >();
      for (const s of userSubmissions) {
        if (!subByAssignment.has(s.assignmentId))
          subByAssignment.set(s.assignmentId, s as any);
      }

      const gradeByAssignment = new Map<
        string,
        { id: string; grade: string; grade_number: number }
      >();
      for (const g of userGrades) {
        if (!gradeByAssignment.has(g.assignmentId))
          gradeByAssignment.set(g.assignmentId, g);
      }

      // Compute per-assignment status and due label
      const now = new Date();
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      const normalized = assignments.map((a) => {
        const submission = subByAssignment.get(a.id) || null;
        const gradeFromSubmission = submission?.grade || null;
        const gradeDirect = gradeByAssignment.get(a.id) || null;
        const grade = gradeFromSubmission?.grade ?? gradeDirect?.grade ?? null;
        const grade_number =
          gradeFromSubmission?.grade_number ?? gradeDirect?.grade_number ?? null;
        const status = grade ? 'GRADED' : submission ? 'SUBMITTED' : 'PENDING';

        let due_in_days: number | null = null;
        let due_label: string | null = null;
        let is_overdue = false;
        if (a.due_date) {
          const diff = a.due_date.getTime() - now.getTime();
          const days = Math.ceil(diff / MS_PER_DAY);
          if (days > 0 && status === 'PENDING') {
            due_in_days = days;
            due_label = `Due ${days} day${days === 1 ? '' : 's'}`;
          } else if (days <= 0) {
            is_overdue = status === 'PENDING';
          }
        }

        return {
          id: a.id,
          title: a.title,
          class_id: a.moduleClass.id,
          class_title: a.moduleClass.class_title,
          class_name: a.moduleClass.class_name,
          module_id: a.moduleClass.module.id,
          module_title: a.moduleClass.module.module_title,
          module_name: a.moduleClass.module.module_name,
          due_date: a.due_date,
          due_in_days,
          due_label,
          is_overdue,
          submitted: !!submission,
          submittedAt: submission?.submittedAt ?? null,
          grade,
          grade_number,
          status,
        };
      });

      // Order modules per course order and group assignments under each module
      const modulesOrder = await this.prisma.courseModule.findMany({
        where: enrollment?.courseModuleId
          ? { id: enrollment.courseModuleId }
          : { courseId },
        select: { id: true, module_title: true, module_name: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      const moduleIndex = new Map<string, number>();
      modulesOrder.forEach((m, idx) => moduleIndex.set(m.id, idx));

      const groupedMap = new Map<
        string,
        {
          module_id: string;
          module_title: string | null;
          module_name: string | null;
          assignments: typeof normalized;
        }
      >();

      for (const item of normalized) {
        if (!groupedMap.has(item.module_id)) {
          groupedMap.set(item.module_id, {
            module_id: item.module_id,
            module_title: item.module_title,
            module_name: item.module_name,
            assignments: [],
          });
        }
        groupedMap.get(item.module_id)!.assignments.push(item);
      }

      // Build sorted array of modules with their assignments sorted by due_date
      const grouped = Array.from(groupedMap.values())
        .sort((a, b) => (moduleIndex.get(a.module_id)! - moduleIndex.get(b.module_id)!))
        .map((grp) => ({
          module_id: grp.module_id,
          module_title: grp.module_title,
          module_name: grp.module_name,
          assignments: grp.assignments.sort((x, y) => {
            const dx = x.due_date ? x.due_date.getTime() : 0;
            const dy = y.due_date ? y.due_date.getTime() : 0;
            return dx - dy;
          }),
        }));

      return { success: true, data: grouped };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching assignments');
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

      const course = await this.prisma.course.findUnique({ where: { id: courseId } });

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
        assets: m.classes
          .flatMap((c) =>
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
        assets: m.classes
          .flatMap((c) =>
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
}
