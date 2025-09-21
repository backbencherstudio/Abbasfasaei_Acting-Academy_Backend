import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';

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
      console.log('Fetching course details for course ID:', courseId);

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        include: {
          modules: {
            include: {
              classes: true,
            },
          },
          instructor: {
            select: { id: true, name: true, avatar: true, about: true },
          },
        },
      });

      console.log('course:', course);

      if (!course) {
        return { success: false, message: 'Course not found' };
      }

      const isEnrolled = await this.prisma.enrollment.findFirst({
        where: {
          courseId: courseId,
          user_id: userId,
        },
      });

      return {
        success: true,
        data: {
          ...course,
          isEnrolled: !!isEnrolled,
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
        return {
          success: false,
          message: 'User ID is required',
        };
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
            select: {
              id: true,
              module_title: true,
              module_name: true,
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

      // Automatically resolve the next upcoming class by time
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
        data: {
          ...course,
          nextClass,
          isEnrolled: !!enrollment,
        },
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

      // Fetch assignments for a course via moduleClass -> module -> course
      const assignments = await this.prisma.assignment.findMany({
        where: {
          moduleClass: { module: { courseId } },
        },
        orderBy: { due_date: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          due_date: true,
          moduleClass: {
            select: { id: true, class_title: true, class_name: true },
          },
          // Direct grades for this assignment by the user (teacher grading)
          grades: {
            where: { studentId: userId },
            select: {
              id: true,
              grade: true,
              grade_number: true,
              submissionId: true,
            },
          },
          // Submissions by the user, including any attached grade via relation
          submissions: {
            where: { studentId: userId },
            select: {
              id: true,
              submittedAt: true,
              grade: { select: { id: true, grade: true, grade_number: true } },
            },
          },
        },
      });

      // Map to simplified payload: title, class name/title, and user's grade if available
      const data = assignments.map((a) => {
        const submission = a.submissions?.[0];
        const gradeFromSubmission = submission?.grade || null;
        const gradeDirect = a.grades?.[0] || null;
        const grade = gradeFromSubmission?.grade ?? gradeDirect?.grade ?? null;
        const grade_number =
          gradeFromSubmission?.grade_number ??
          gradeDirect?.grade_number ??
          null;
        return {
          id: a.id,
          title: a.title,
          name: a.moduleClass.class_name ?? a.moduleClass.class_title,
          class_title: a.moduleClass.class_title,
          class_name: a.moduleClass.class_name,
          due_date: a.due_date,
          submitted: !!submission,
          submittedAt: submission?.submittedAt ?? null,
          grade,
          grade_number,
        };
      });

      return { success: true, data };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching assignments');
    }
  }
}
