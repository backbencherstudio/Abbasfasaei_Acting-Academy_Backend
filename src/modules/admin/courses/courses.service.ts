import { Injectable } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateModuleDto } from './dto/update-module.dto';
import { StringHelper } from 'src/common/helper/string.helper';
import { SazedStorage } from 'src/common/lib/disk/SazedStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async create_course(adminUserId: string, createCourseDto: CreateCourseDto) {
    console.log('User Id from token:', adminUserId);

    if (!adminUserId) {
      return { message: 'Unauthorized', success: false };
    }

    // Ensure the instructor exists and has the TEACHER role via role_users
    const instructor = await this.prisma.user.findFirst({
      where: {
        id: createCourseDto.instructorId,
        role_users: {
          some: { role: { name: { equals: 'TEACHER', mode: 'insensitive' } } },
        },
      },
    });

    // console.log("instructor:", instructor);

    if (!instructor) {
      return { message: 'Instructor not found', success: false };
    }

    const course = await this.prisma.course.create({
      data: {
        title: createCourseDto.title,
        createdBy: adminUserId,
        created_at: new Date(),
        installment_process: createCourseDto.installment_process || null,
        course_overview: createCourseDto.course_overview || null,
        course_module_details: createCourseDto.course_module_details || null,
        seat_capacity: createCourseDto.seat_capacity,
        instructor: {
          connect: { id: createCourseDto.instructorId },
        },
        fee: parseFloat(createCourseDto.fee.toString()),
        duration: createCourseDto.duration,
        start_date: new Date(createCourseDto.start_date),
        class_time: createCourseDto.class_time,
      },
      select: {
        id: true,
        title: true,
        created_at: true,
        updated_at: true,
        status: true,
        seat_capacity: true,
        fee: true,
        duration: true,
        start_date: true,
        class_time: true,
        createdBy: true,
        course_overview: true,
        course_module_details: true,
        installment_process: true,
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone_number: true,
            status: true,
            // role removed; if needed, include role_users
            avatar: true,
            about: true,
            billing_id: true,
          },
        },
        modules: true,
        enrollments: true,
      },
    });

    return {
      message: 'Course created successfully',
      success: true,
      data: course,
    };
  }

  async getAllCourses(userId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const courses = await this.prisma.course.findMany({
        select: {
          id: true,
          title: true,
          created_at: true,
          status: true,
          seat_capacity: true,
          fee: true,
          duration: true,
          updated_at: true,
          start_date: true,
          class_time: true,
          createdBy: true,
          course_overview: true,
          course_module_details: true,
          installment_process: true,
          instructor: {
            select: {
              name: true,
              email: true,
              phone_number: true,
            },
          },
          modules: true,
          enrollments: true,
        },
      });

      if (courses.length === 0) {
        return { message: 'No courses found', success: false, data: [] };
      }

      // Return the courses
      return {
        message: 'Courses fetched successfully',
        success: true,
        data: courses,
      };
    } catch (error) {
      console.error('Error fetching courses:', error);
      throw new Error('Could not fetch courses');
    }
  }

  async getCourseById(userId: string, id: string) {
    if (!userId) {
      return { message: 'Unauthorized', success: false };
    }

    const course = await this.prisma.course.findUnique({
      where: { id: id },
      select: {
        id: true,
        title: true,
        created_at: true,
        status: true,
        seat_capacity: true,
        fee: true,
        duration: true,
        updated_at: true,
        start_date: true,
        class_time: true,
        createdBy: true,
        course_overview: true,
        course_module_details: true,
        installment_process: true,
        instructor: {
          select: {
            name: true,
            email: true,
            phone_number: true,
          },
        },
        modules: true,
        enrollments: true,
      },
    });

    if (!course) {
      return { message: 'Course not found', success: false };
    }
    return {
      message: 'Course fetched successfully',
      success: true,
      data: course,
    };
  }

  async updateCourse(
    userId: string,
    id: string,
    updateCourseDto: UpdateCourseDto,
  ) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      console.log('course id:', id);

      const course = await this.prisma.course.findUnique({
        where: { id: id },
      });

      console.log('course:', course);

      if (!course) {
        return { message: 'Course not found', success: false };
      }

      const updatedCourse = await this.prisma.course.update({
        where: { id: id },
        data: {
          title: updateCourseDto.title ?? course.title,
          updated_at: new Date(),
          seat_capacity:
            updateCourseDto.seat_capacity !== undefined
              ? updateCourseDto.seat_capacity
              : course.seat_capacity,
          fee:
            updateCourseDto.fee !== undefined
              ? parseFloat(updateCourseDto.fee.toString())
              : course.fee,
          duration: updateCourseDto.duration ?? course.duration,
          class_time: updateCourseDto.class_time ?? course.class_time,
          start_date: updateCourseDto.start_date
            ? new Date(updateCourseDto.start_date)
            : course.start_date,
          instructorId:
            updateCourseDto.instructorId !== undefined
              ? updateCourseDto.instructorId
              : course.instructorId,
        },
      });

      return {
        message: 'Course updated successfully',
        success: true,
        data: updatedCourse,
      };
    } catch (error) {
      console.error('Error updating course:', error);
      throw new Error('Could not update course');
    }
  }

  async deleteCourse(userId: string, id: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const course = await this.prisma.course.findUnique({
        where: { id: id },
      });

      if (!course) {
        return { message: 'Course not found', success: false };
      }

      await this.prisma.course.delete({
        where: { id: id },
      });

      return {
        message: 'Course deleted successfully',
        success: true,
      };
    } catch (error) {
      console.error('Error deleting course:', error);
      throw new Error('Could not delete course');
    }
  }

  //------------------------------- Module Management -------------------------------

  async addModule(
    userId: string,
    courseId: string,
    createModuleDto: CreateModuleDto,
  ) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        return { message: 'Course not found', success: false };
      }

      const module = await this.prisma.courseModule.create({
        data: {
          module_title: createModuleDto.module_title,
          module_name: createModuleDto.module_name,
          module_overview: createModuleDto.module_overview,
          course: {
            connect: { id: courseId },
          },
        },
        select: {
          id: true,
          module_title: true,
          module_name: true,
          module_overview: true,
          courseId: true,
          createdAt: true,
          updatedAt: true,
          classes: true,
        },
      });

      return {
        message: 'Module added successfully',
        success: true,
        data: module,
      };
    } catch (error) {
      console.error('Error adding module:', error);
      throw new Error('Could not add module');
    }
  }

  async getAllModules(userId: string, courseId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        return { message: 'Course not found', success: false };
      }

      const modules = await this.prisma.courseModule.findMany({
        where: { courseId: courseId },
        select: {
          id: true,
          module_title: true,
          module_name: true,
          module_overview: true,
          courseId: true,
          createdAt: true,
          updatedAt: true,
          classes: true,
        },
      });

      return {
        message: 'Modules fetched successfully',
        success: true,
        data: modules,
      };
    } catch (error) {
      console.error('Error fetching modules:', error);
      throw new Error('Could not fetch modules');
    }
  }

  async getModuleById(userId: string, moduleId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const module = await this.prisma.courseModule.findUnique({
        where: { id: moduleId },
      });

      if (!module) {
        return { message: 'Module not found', success: false };
      }

      return {
        message: 'Module fetched successfully',
        success: true,
        data: module,
      };
    } catch (error) {
      console.error('Error fetching module:', error);
      throw new Error('Could not fetch module');
    }
  }

  async updateModule(
    userId: string,
    moduleId: string,
    updateModuleDto: UpdateModuleDto,
  ) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const module = await this.prisma.courseModule.findUnique({
        where: { id: moduleId },
      });

      if (!module) {
        return { message: 'Module not found', success: false };
      }

      const updatedModule = await this.prisma.courseModule.update({
        where: { id: moduleId },
        data: {
          module_title:
            updateModuleDto.module_title !== undefined
              ? updateModuleDto.module_title
              : module.module_title,
          module_name:
            updateModuleDto.module_name !== undefined
              ? updateModuleDto.module_name
              : module.module_name,
          module_overview:
            updateModuleDto.module_overview !== undefined
              ? updateModuleDto.module_overview
              : module.module_overview,
        },
      });

      return {
        message: 'Module updated successfully',
        success: true,
        data: updatedModule,
      };
    } catch (error) {
      console.error('Error updating module:', error);
      throw new Error('Could not update module');
    }
  }

  async deleteModule(userId: string, moduleId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const module = await this.prisma.courseModule.findUnique({
        where: { id: moduleId },
      });

      if (!module) {
        return { message: 'Module not found', success: false };
      }

      await this.prisma.courseModule.delete({
        where: { id: moduleId },
      });

      return {
        message: 'Module deleted successfully',
        success: true,
      };
    } catch (error) {
      console.error('Error deleting module:', error);
      throw new Error('Could not delete module');
    }
  }

  //------------------------------- Class Management -------------------------------
  async addClass(userId: string, moduleId: string, createClassDto: any) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const module = await this.prisma.courseModule.findUnique({
        where: { id: moduleId },
      });

      console.log('course module:', module);

      if (!module) {
        return { message: 'Module not found', success: false };
      }

      const newClass = await this.prisma.moduleClass.create({
        data: {
          class_title: createClassDto.class_title,
          class_name: createClassDto.class_name,
          class_overview: createClassDto.class_overview,
          duration: createClassDto.duration,
          start_date: createClassDto.start_date,
          class_time: createClassDto.class_time,
          moduleId: moduleId,
        },
        select: {
          id: true,
          class_title: true,
          class_name: true,
          class_overview: true,
          duration: true,
          start_date: true,
          class_time: true,
          moduleId: true,
          createdAt: true,
          updatedAt: true,
          attendances: true,
          assignments: true,
          classAssets: true,
        },
      });

      return {
        message: 'Class added successfully',
        success: true,
        data: newClass,
      };
    } catch (error) {
      console.error('Error adding class:', error);
      throw new Error('Could not add class');
    }
  }

  async getAllClasses(userId: string, moduleId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const module = await this.prisma.courseModule.findUnique({
        where: { id: moduleId },
      });

      if (!module) {
        return { message: 'Module not found', success: false };
      }

      const classes = await this.prisma.moduleClass.findMany({
        where: { moduleId: moduleId },
        select: {
          id: true,
          class_title: true,
          class_name: true,
          class_overview: true,
          duration: true,
          start_date: true,
          class_time: true,
          moduleId: true,
          createdAt: true,
          updatedAt: true,
          attendances: true,
          assignments: true,
          classAssets: true,
        },
      });

      if (!classes || classes.length === 0) {
        return { message: 'No classes found', success: false };
      }

      return {
        message: 'Classes fetched successfully',
        success: true,
        data: classes,
      };
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw new Error('Could not fetch classes');
    }
  }

  async getClassById(userId: string, classId: string) {
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

      return {
        message: 'Class fetched successfully',
        success: true,
        data: existingClass,
      };
    } catch (error) {
      console.error('Error fetching class:', error);
      throw new Error('Could not fetch class');
    }
  }

  async deleteClass(userId: string, classId: string) {
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

      await this.prisma.moduleClass.delete({
        where: { id: classId },
      });

      return {
        message: 'Class deleted successfully',
        success: true,
      };
    } catch (error) {
      console.error('Error deleting class:', error);
      throw new Error('Could not delete class');
    }
  }

  async updateClass(userId: string, classId: string, updateClassDto: any) {
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

      const updatedClass = await this.prisma.moduleClass.update({
        where: { id: classId },
        data: {
          class_title: updateClassDto.class_title || existingClass.class_title,
          class_name: updateClassDto.class_name || existingClass.class_name,
          class_overview:
            updateClassDto.class_overview || existingClass.class_overview,
          duration: updateClassDto.duration || existingClass.duration,
          start_date: updateClassDto.start_date || existingClass.start_date,
          class_time: updateClassDto.class_time || existingClass.class_time,
        },
      });

      if (!updatedClass) {
        return { message: 'Class not found', success: false };
      }

      return {
        message: 'Class updated successfully',
        success: true,
        data: updatedClass,
      };
    } catch (error) {
      console.error('Error updating class:', error);
      throw new Error('Could not update class');
    }
  }

  //------------------------------- End of Class Management -------------------------------

  //------------------------------- assignments Management -------------------------------

  async createAssignment(
    userId: string,
    classId: string,
    createAssignmentDto: any,
    files: Express.Multer.File[],
  ) {
    let mediaUrls: string[] = [];

    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const existingClass = await this.prisma.moduleClass.findUnique({
        where: { id: classId },
        select: {
          id: true,
          module: {
            select: {
              course: {
                select: {
                  instructorId: true,
                },
              },
            },
          },
        },
      });

      if (!existingClass) {
        return { message: 'Class not found', success: false };
      }

      const submissionDate = new Date(createAssignmentDto.submission_date);
      const dueDate: Date = createAssignmentDto?.due_date
        ? new Date(createAssignmentDto.due_date)
        : submissionDate;

      const teacherId: string =
        existingClass?.module?.course?.instructorId ?? userId;

      if (files && files.length > 0) {
        for (const file of files) {
          const filename = `${StringHelper.randomString(10)}_${file.originalname}`;

          await SazedStorage.put(
            appConfig().storageUrl.attachment + `/${filename}`,
            file.buffer,
          );

          mediaUrls.push(
            process.env.AWS_S3_ENDPOINT +
              '/' +
              process.env.AWS_S3_BUCKET +
              appConfig().storageUrl.attachment +
              `/${filename}`,
          );
        }
      }

      const assignment = await this.prisma.assignment.create({
        data: {
          title: createAssignmentDto.title,
          description: createAssignmentDto.description,
          attachment_url: mediaUrls.length > 0 ? mediaUrls : null,
          submission_Date: submissionDate,
          due_date: dueDate,
          total_marks: createAssignmentDto.total_marks,
          teacher: {
            connect: { id: teacherId },
          },
          moduleClass: {
            connect: { id: classId },
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          submission_Date: true,
          due_date: true,
          total_marks: true,
          moduleClass: {
            select: {
              id: true,
              class_title: true,
              class_name: true,
            },
          },
          teacher: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!assignment) {
        return { message: 'Assignment not created', success: false };
      }

      return {
        message: 'Assignment created successfully',
        success: true,
        data: assignment,
      };
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw new Error('Could not create assignment');
    }
  }

  async getAllAssignments(userId: string, classId: string) {
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
          attachment_url: true,
          submission_Date: true,
          due_date: true,
          total_marks: true,
          moduleClass: {
            select: {
              id: true,
              class_title: true,
              class_name: true,
            },
          },

          submissions: {
            select: { id: true, studentId: true, total_Submissions: true },
          },
          grades: { select: { id: true, studentId: true, total_graded: true } },
        },
      });

      return {
        message: 'Assignments retrieved successfully',
        success: true,
        data: assignments,
      };
    } catch (error) {
      console.error('Error retrieving assignments:', error);
      throw new Error('Could not retrieve assignments');
    }
  }

  async getAssignmentById(userId: string, assignmentId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          title: true,
          description: true,
          attachment_url: true,
          submission_Date: true,
          due_date: true,
          total_marks: true,
          moduleClass: {
            select: {
              id: true,
              class_title: true,
              class_name: true,
            },
          },
        },
      });

      if (!assignment) {
        return { message: 'Assignment not found', success: false };
      }

      return {
        message: 'Assignment retrieved successfully',
        success: true,
        data: assignment,
      };
    } catch (error) {
      console.error('Error retrieving assignment:', error);
      throw new Error('Could not retrieve assignment');
    }
  }

  async updateAssignment(
    userId: string,
    assignmentId: string,
    updateAssignmentDto: any,
    files: Express.Multer.File[],
  ) {
    let mediaUrls: string[] = [];
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
      });

      if (!assignment) {
        return { message: 'Assignment not found', success: false };
      }

      if (files && files.length > 0) {
        for (const file of files) {
          const filename = `${StringHelper.randomString(10)}_${file.originalname}`;
          await SazedStorage.put(
            appConfig().storageUrl.attachment + `/${filename}`,
            file.buffer,
          );

          mediaUrls.push(
            process.env.AWS_S3_ENDPOINT +
              '/' +
              process.env.AWS_S3_BUCKET +
              appConfig().storageUrl.attachment +
              `/${filename}`,
          );
        }
      }

      const updatedAssignment = await this.prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          title: updateAssignmentDto.title || assignment.title,
          description:
            updateAssignmentDto.description || assignment.description,
          attachment_url:
            mediaUrls.length > 0 ? mediaUrls : assignment.attachment_url,
          submission_Date:
            updateAssignmentDto.submission_date || assignment.submission_Date,
          total_marks:
            updateAssignmentDto.total_marks || assignment.total_marks,
          due_date: updateAssignmentDto.submission_date
            ? new Date(
                new Date(updateAssignmentDto.submission_date).getTime() -
                  Date.now(),
              ).toISOString()
            : assignment.due_date,
        },
      });

      return {
        message: 'Assignment updated successfully',
        success: true,
        data: updatedAssignment,
      };
    } catch (error) {
      console.error('Error updating assignment:', error);
      throw new Error('Could not update assignment');
    }
  }

  async deleteAssignment(userId: string, assignmentId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
      });

      if (!assignment) {
        return { message: 'Assignment not found', success: false };
      }

      await this.prisma.assignment.delete({
        where: { id: assignmentId },
      });
      return {
        message: 'Assignment deleted successfully',
        success: true,
      };
    } catch (error) {
      console.error('Error deleting assignment:', error);
      throw new Error('Could not delete assignment');
    }
  }

  async getAllAssignmentsSubmissions(userId: string, assignmentId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
      });

      if (!assignment) {
        return { message: 'Assignment not found', success: false };
      }

      const submissions = await this.prisma.assignmentSubmission.findMany({
        where: { assignmentId: assignmentId },
        select: {
          id: true,
          studentId: true,
          total_Submissions: true,
          submittedAt: true,
          fileUrl: true,

          assignment: {
            select: {
              id: true,
              title: true,
              description: true,
              submission_Date: true,
              attachment_url: true,
              total_marks: true,
            },
          },

          grade: {
            select: {
              id: true,
              gradedAt: true,
              feedback: true,
              gradedBy: true,
              grade: true,
              grade_number: true,
            },
          },
          student: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      return {
        message: 'Submissions retrieved successfully',
        success: true,
        data: submissions,
      };
    } catch (error) {
      console.error('Error retrieving submissions:', error);
      throw new Error('Could not retrieve submissions');
    }
  }

  async getSubmissionById(userId: string, submissionId: string) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const submission = await this.prisma.assignmentSubmission.findUnique({
        where: { id: submissionId },
        select: {
          id: true,
          studentId: true,
          total_Submissions: true,
          submittedAt: true,
          fileUrl: true,
          assignment: {
            select: {
              id: true,
              title: true,
              description: true,
              submission_Date: true,
              attachment_url: true,
              total_marks: true,
            },
          },
          grade: {
            select: {
              id: true,
              gradedAt: true,
              feedback: true,
              gradedBy: true,
              grade: true,
              grade_number: true,
            },
          },
          student: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!submission) {
        return { message: 'Submission not found', success: false };
      }

      return {
        message: 'Submission retrieved successfully',
        success: true,
        data: submission,
      };
    } catch (error) {
      console.error('Error retrieving submission:', error);
      throw new Error('Could not retrieve submission');
    }
  }

  async gradeSubmission(
    userId: string,
    submissionId: string,
    gradeSubmissionDto: any,
  ) {
    try {
      if (!userId) {
        return { message: 'Unauthorized', success: false };
      }

      const submission = await this.prisma.assignmentSubmission.findUnique({
        where: { id: submissionId },
      });

      if (!submission) {
        return { message: 'Submission not found', success: false };
      }

      // Check existing grade either by submissionId (unique) or by assignment+student unique pair
      const existingGrade = await this.prisma.assignmentGrade.findFirst({
        where: {
          OR: [
            { submissionId: submissionId },
            {
              assignmentId: submission.assignmentId,
              studentId: submission.studentId,
            },
          ],
        },
      });

      if (existingGrade) {
        return { message: 'Submission already graded', success: false };
      }

      // make a grade (a+, a-, a, b+, b-, b, etc..) based on the total marks of the assignment
      const assignment = await this.prisma.assignment.findUnique({
        where: { id: submission.assignmentId },
      });

      if (!assignment) {
        return {
          message: 'Assignment not found for the submission',
          success: false,
        };
      }

      if (gradeSubmissionDto.grade_number > assignment.total_marks) {
        return {
          message: 'Grade number exceeds total marks of the assignment',
          success: false,
        };
      }

      // Helper function to determine grade letter
      // Example: A+ for 90-100%, A for 80-89%, B for 70-79%, etc.
      // You can customize this logic as per your grading system
      const getGradeLetter = (grade: number, total: number): string => {
        const percentage = (grade / total) * 100;
        if (percentage >= 90) return 'A+';
        if (percentage >= 80) return 'A';
        if (percentage >= 70) return 'B';
        if (percentage >= 60) return 'C';
        if (percentage >= 50) return 'D';
        return 'F';
      };

      const gradeLetter = getGradeLetter(
        gradeSubmissionDto.grade_number,
        assignment.total_marks,
      );

      const grade = await this.prisma.assignmentGrade.create({
        data: {
          feedback: gradeSubmissionDto.feedback,
          grade: gradeLetter,
          grade_number: gradeSubmissionDto.grade_number,
          gradedBy: userId,
          assignment: { connect: { id: submission.assignmentId } },
          student: { connect: { id: submission.studentId } },
          teacher: { connect: { id: userId } },
          submission: { connect: { id: submissionId } },
        },
      });

      return {
        message: 'Submission graded successfully',
        success: true,
        data: grade,
      };
    } catch (error) {
      console.error('Error grading submission:', error);
      throw new Error('Could not grade submission');
    }
  }
}
