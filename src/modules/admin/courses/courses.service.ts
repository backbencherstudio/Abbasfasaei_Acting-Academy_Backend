import { Injectable } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateModuleDto } from './dto/update-module.dto';

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
          start_date:
            updateCourseDto.start_date
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

  async addModule(userId: string, courseId: string, createModuleDto: CreateModuleDto) {
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

  async updateModule(userId: string, moduleId: string, updateModuleDto: UpdateModuleDto) {
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
          module_title: updateModuleDto.module_title !== undefined ? updateModuleDto.module_title : module.module_title,
          module_name: updateModuleDto.module_name !== undefined ? updateModuleDto.module_name : module.module_name,
          module_overview: updateModuleDto.module_overview !== undefined ? updateModuleDto.module_overview : module.module_overview,
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

      console.log("course module:", module);

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
          class_overview: updateClassDto.class_overview || existingClass.class_overview,
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

}