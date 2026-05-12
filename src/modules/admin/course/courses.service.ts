import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateModuleDto } from './dto/update-module.dto';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';
import { AttendanceService } from './attendance.helper';
import { Role } from 'src/common/guard/role/role.enum';
import { GetAllAssignmentQueryDto, GetAllCourseQueryDto } from './dto/query-course.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateAssignmentDto, GradeAssignmentDto } from './dto/create-assignment.dto';
import { AttachmentType, Prisma } from '@prisma/client';

@Injectable()
export class CoursesService {
  private readonly attendanceService: AttendanceService;

  constructor(private prisma: PrismaService) {
    this.attendanceService = new AttendanceService(prisma);
  }

  generateClassQR(classId: string, teacherId: string) {
    return this.attendanceService.generateClassQR(classId, teacherId);
  }

  getAllAttendance(query?: any) {
    return this.attendanceService.getAllAttendance(query);
  }

  markManualAttendance(body: any, userId: string) {
    return this.attendanceService.markManualAttendance(body, userId);
  }


  async createCourse(user_id: string, createCourseDto: CreateCourseDto) {
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const { instructor_id, ...courseData } = createCourseDto;

    const instructor = await this.prisma.user.findUnique({
      where: {
        id: instructor_id,
        type: Role.TEACHER,
      },
    });

    if (!instructor) {
      throw new NotFoundException('Instructor not found');
    }

    await this.prisma.course.create({
      data: {
        ...courseData,
        fee_pence: (+courseData?.fee_pence * 100).toString() || 0,
        creator: {
          connect: { id: user_id },
        },
        instructor: {
          connect: { id: instructor_id },
        },
      },
    });

    return {
      message: 'Course created successfully',
      success: true,
    };
  }

  async getAllCourses(user_id: string, query: GetAllCourseQueryDto) {
    const { status, search, limit = 10, page = 1 } = query;
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const where: Prisma.CourseWhereInput = {
      status,
      instructor_id: user.type === Role.TEACHER ? user_id : undefined,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { course_overview: { contains: search, mode: 'insensitive' } },
          { instructor: { name: { contains: search, mode: 'insensitive' } } },
          { instructor: { email: { contains: search, mode: 'insensitive' } } },
          { instructor: { phone_number: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };


    const courses = await this.prisma.course.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        seat_capacity: true,
        fee_pence: true,
        duration: true,
        start_date: true,
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            enrollments: {
              where: {
                status: 'ACTIVE',
                step: 'COMPLETED',
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: (page - 1) * limit,
    });

    const total_courses = await this.prisma.course.count({
      where,
    });

    return {
      message: 'Courses fetched successfully',
      success: true,
      data: courses.map((course) => {
        const total_enrollments = course._count.enrollments;
        delete course._count;
        return {
          ...course,
          fee: (+course?.fee_pence / 100).toFixed(2) || 0,
          total_enrollments,
        };
      }),
      meta_data: {
        page,
        limit,
        total: total_courses,
        search,
        status
      }
    };

  }

  async getCourseById(userId: string, id: string) {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: id },
      select: {
        id: true,
        title: true,
        status: true,
        seat_capacity: true,
        fee_pence: true,
        duration: true,
        start_date: true,
        class_time: true,
        course_overview: true,
        installment_process: true,
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            enrollments: {
              where: {
                status: 'ACTIVE',
                step: 'COMPLETED',
              },
            },
          },
        },
      },
    });

    if (!course) {
      return { message: 'Course not found', success: false };
    }
    const total_enrollments = course._count.enrollments;
    delete course._count;

    const course_progress = Math.max(0, Math.min(100, course?.duration ? ((Date.now() - new Date(course.start_date).getTime()) / (Number(course.duration) * 86400000)) * 100 : 0));
    return {
      message: 'Course fetched successfully',
      success: true,
      data: {
        ...course,
        fee: (+course?.fee_pence / 100).toFixed(2) || 0,
        total_enrollments,
        course_progress,
      },
    };
  }

  async updateCourse(
    user_id: string,
    id: string,
    updateCourseDto: UpdateCourseDto,
  ) {

    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: id },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (updateCourseDto.instructor_id) {
      const instructor = await this.prisma.user.findUnique({
        where: { id: updateCourseDto.instructor_id },
      });
      if (!instructor) {
        throw new NotFoundException('Instructor not found');
      }
    }

    await this.prisma.course.update({
      where: { id: id },
      data: {
        title: updateCourseDto.title ?? course.title,
        seat_capacity: updateCourseDto.seat_capacity ?? course.seat_capacity,
        fee_pence: updateCourseDto.fee_pence ? (+updateCourseDto.fee_pence * 100) || 0 : course.fee_pence,
        duration: updateCourseDto.duration ?? course.duration,
        class_time: updateCourseDto.class_time ?? course.class_time,
        start_date: updateCourseDto.start_date ?? course.start_date,
        instructor_id: updateCourseDto.instructor_id ?? course.instructor_id,
        course_overview: updateCourseDto.course_overview ?? course.course_overview,
        installment_process: updateCourseDto.installment_process ?? course.installment_process,
        rules_regulations: updateCourseDto.rules_regulations ?? course.rules_regulations,
        contract: updateCourseDto.contract ?? course.contract,
      },
    });

    return {
      message: 'Course updated successfully',
      success: true,
    };

  }

  async deleteCourse(user_id: string, id: string) {
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: id },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    await this.prisma.course.delete({
      where: { id: id },
    });

    return {
      message: 'Course deleted successfully',
      success: true,
    };

  }

  //------------------------------- Module Management -------------------------------

  async addModule(
    user_id: string,
    course_id: string,
    createModuleDto: CreateModuleDto,
  ) {
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: course_id },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existing_module = await this.prisma.courseModule.findFirst({
      where: {
        course_id: course_id,
        module_title: createModuleDto.module_title,
      },
    });
    if (existing_module) {
      throw new ConflictException(`Module with title "${createModuleDto.module_title}" already exists in this course`);
    }

    const courseModule = await this.prisma.courseModule.create({
      data: {
        module_title: createModuleDto.module_title,
        module_name: createModuleDto.module_name,
        module_overview: createModuleDto.module_overview,
        course: {
          connect: { id: course_id },
        },
        creator: {
          connect: { id: user_id },
        }
      },
    });

    if (!courseModule) {
      throw new Error('Failed to add module');
    }

    return {
      message: 'Module added successfully',
      success: true,
    };

  }

  async getAllModules(user_id: string, course_id: string) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');

    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('User not found');

    const course = await this.prisma.course.findUnique({ where: { id: course_id } });
    if (!course) throw new NotFoundException('Course not found');

    const modules = await this.prisma.courseModule.findMany({
      where: { course_id: course_id },
      select: {
        id: true,
        module_title: true,
        module_name: true,
        module_overview: true,
        course_id: true,
        classes: {
          select: {
            id: true,
            class_title: true,
            class_name: true,
            start_at: true,
            end_at: true,
          },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const now = new Date();
    const nextClass = modules
      .flatMap((m) => m.classes)
      .filter((c) => new Date(c.start_at) > now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

    return {
      message: 'Modules fetched successfully',
      success: true,
      data: modules.map((moduleItem) => ({
        ...moduleItem,
        classes: moduleItem.classes.map((classItem) => {
          let status = 'PENDING';
          const startTime = new Date(classItem.start_at);

          if (startTime < now) {
            status = 'COMPLETED';
          } else if (nextClass && classItem.id === nextClass.id) {
            status = 'NEXT';
          }

          return {
            ...classItem,
            status,
          };
        }),
      })),
    };
  }

  async getModuleById(user_id: string, module_id: string) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('User not found');

    const courseModule = await this.prisma.courseModule.findUnique({
      where: { id: module_id },
      select: {
        id: true,
        module_title: true,
        module_name: true,
        module_overview: true,
        course_id: true,
      }
    });

    if (!courseModule) {
      throw new NotFoundException('Module not found');
    }

    return {
      message: 'Module fetched successfully',
      success: true,
      data: courseModule,
    };
  }

  async updateModule(
    user_id: string,
    module_id: string,
    updateModuleDto: UpdateModuleDto,
  ) {

    if (!user_id) throw new UnauthorizedException('Unauthorized');
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('User not found');

    const courseModule = await this.prisma.courseModule.findUnique({
      where: { id: module_id },
    });

    if (!courseModule) throw new NotFoundException('Module not found');

    const existing_module = await this.prisma.courseModule.findFirst({
      where: {
        course_id: courseModule.course_id,
        module_title: updateModuleDto.module_title,
      },
    });
    if (existing_module)
      throw new ConflictException(`Module with title "${updateModuleDto.module_title}" already exists in this course`);


    const updatedModule = await this.prisma.courseModule.update({
      where: { id: module_id },
      data: {
        module_title:
          updateModuleDto.module_title ?? courseModule.module_title,
        module_name:
          updateModuleDto.module_name ?? courseModule.module_name,
        module_overview:
          updateModuleDto.module_overview ?? courseModule.module_overview,
      },
    });

    return {
      message: 'Module updated successfully',
      success: true,
      data: updatedModule,
    };

  }

  async deleteModule(user_id: string, module_id: string) {

    if (!user_id) throw new UnauthorizedException('Unauthorized');
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('User not found');

    const courseModule = await this.prisma.courseModule.findUnique({
      where: { id: module_id },
    });

    if (!courseModule) throw new NotFoundException('Module not found');

    await this.prisma.courseModule.delete({
      where: { id: module_id },
    });

    return {
      message: 'Module deleted successfully',
      success: true,
    };

  }

  //------------------------------- Class Management -------------------------------
  async addClass(user_id: string, module_id: string, createClassDto: CreateClassDto) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('User not found');

    const courseModule = await this.prisma.courseModule.findUnique({
      where: { id: module_id },
    });

    if (!courseModule) throw new NotFoundException('Module not found');

    // Combine start_at date with class_time
    const class_at = new Date(createClassDto.class_date);
    if (createClassDto.class_time) {
      const [hours, minutes] = createClassDto.class_time.split(':').map(Number);
      class_at.setHours(hours, minutes, 0, 0);
    }

    const newClass = await this.prisma.moduleClass.create({
      data: {
        class_title: createClassDto.class_title,
        class_name: createClassDto.class_name,
        class_overview: createClassDto.class_overview,
        duration: createClassDto.duration,
        class_at: class_at,
        module: { connect: { id: module_id } },
        creator: { connect: { id: user_id } },
      }
    });

    if (!newClass) {
      throw new InternalServerErrorException('Failed to add class');
    }

    return {
      message: 'Class added successfully',
      success: true,
    };
  }

  async getAllClasses(user_id: string, module_id: string) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('User not found');

    const courseModule = await this.prisma.courseModule.findUnique({
      where: { id: module_id },
    });

    if (!courseModule) {
      return { message: 'Module not found', success: false };
    }

    const classes = await this.prisma.moduleClass.findMany({
      where: { module_id: module_id },
      select: {
        id: true,
        class_title: true,
        class_name: true,
        start_at: true,
        end_at: true,
        module_id: true,
      },
    });

    if (!classes || classes.length === 0) {
      return { message: 'No classes found', success: false };
    }

    const now = new Date();

    const nextClass = classes
      .filter((c) => new Date(c.start_at) > now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

    return {
      message: 'Classes fetched successfully',
      success: true,
      data: classes.map((classItem) => {
        let status = 'PENDING';
        const startTime = new Date(classItem.start_at);

        if (startTime < now) {
          status = 'COMPLETED';
        } else if (nextClass && classItem.id === nextClass.id) {
          status = 'NEXT';
        }

        return {
          ...classItem,
          status,
        };
      })
    };

  }

  async getClassById(user_id: string, class_id: string) {

    if (!user_id) throw new UnauthorizedException('Unauthorized');
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('User not found');

    const existingClass = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
      select: {
        id: true,
        class_title: true,
        class_name: true,
        class_overview: true,
        duration: true,
        start_at: true,
        end_at: true,
        module_id: true,
        module: {
          select: {
            course: {
              select: {
                instructor: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
                _count: {
                  select: {
                    enrollments: {
                      where: {
                        status: 'ACTIVE',
                        step: 'COMPLETED',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!existingClass) {
      throw new NotFoundException('Class not found');
    }

    const { module, ...classData } = existingClass;

    // Fetch other classes in the same module to determine if this is the 'NEXT' class
    const classesInModule = await this.prisma.moduleClass.findMany({
      where: { module_id: classData.module_id },
      select: { id: true, start_at: true },
    });

    const now = new Date();
    const nextClass = classesInModule
      .filter((c) => c.start_at && new Date(c.start_at) > now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

    let status = 'PENDING';
    if (classData.start_at && new Date(classData.start_at) < now) {
      status = 'COMPLETED';
    } else if (nextClass && classData.id === nextClass.id) {
      status = 'NEXT';
    }

    const formattedClass = {
      ...classData,
      instructor: module?.course?.instructor,
      total_enrollments: module?.course?._count?.enrollments || 0,
      status: status,
    };

    return {
      message: 'Class fetched successfully',
      success: true,
      data: formattedClass,
    };

  }

  async deleteClass(user_id: string, class_id: string) {

    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('User not found');

    const existingClass = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
    });

    if (!existingClass) {
      throw new NotFoundException('Class not found');
    }

    await this.prisma.moduleClass.delete({
      where: { id: class_id },
    });

    return {
      message: 'Class deleted successfully',
      success: true,
    };
  }

  // updated
  async updateClass(user_id: string, class_id: string, updateClassDto: UpdateClassDto) {

    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('User not found');

    const existingClass = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
    });

    if (!existingClass) {
      throw new NotFoundException('Class not found');
    }

    let newClassDate = new Date(existingClass.class_at);

    if (updateClassDto.class_date) {
      newClassDate = new Date(updateClassDto.class_date);
      newClassDate.setHours(existingClass.class_at.getHours(), existingClass.class_at.getMinutes(), 0, 0);
    }
    if (updateClassDto.class_time) {
      const [hours, minutes] = updateClassDto.class_time.split(':').map(Number);
      newClassDate.setHours(hours, minutes, 0, 0);
    }

    const updatedClass = await this.prisma.moduleClass.update({
      where: { id: class_id },
      data: {
        class_title: updateClassDto.class_title || existingClass.class_title,
        class_name: updateClassDto.class_name || existingClass.class_name,
        class_overview:
          updateClassDto.class_overview || existingClass.class_overview,
        duration: updateClassDto.duration || existingClass.duration,
        class_at: newClassDate,
      },
    });

    if (!updatedClass) {
      throw new InternalServerErrorException('Class not updated');
    }

    return {
      message: 'Class updated successfully',
      success: true,
      data: updatedClass,
    };

  }

  //------------------------------- End of Class Management -------------------------------

  //------------------------------- assignments Management -------------------------------

  async createAssignment(
    userId: string,
    classId: string,
    createAssignmentDto: CreateAssignmentDto,
    attachments: Express.Multer.File[],
  ) {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const existingClass = await this.prisma.moduleClass.findUnique({
      where: { id: classId },
    });

    if (!existingClass) {
      throw new NotFoundException('Class not found');
    }

    const submissionDate = new Date(createAssignmentDto.submission_date);
    const attachmentsData: Prisma.AttachmentCreateInput[] = [];

    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        const filename = SazedStorage.generateFileName(file.originalname);
        const objectKey = `${appConfig().storageUrl.assignment}/${filename}`;

        await SazedStorage.put(objectKey, file.buffer);

        attachmentsData.push({
          file_name: filename,
          file_path: objectKey,
          mime_type: file.mimetype,
          size_bytes: file.size,
        });
      }
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        title: createAssignmentDto.title,
        description: createAssignmentDto.description,
        submission_date: submissionDate,
        total_marks: createAssignmentDto.total_marks,
        creator: {
          connect: { id: userId },
        },
        class: {
          connect: { id: classId },
        },
        attachments: {
          create: attachmentsData,
        },

      },
    });

    if (!assignment) {
      throw new InternalServerErrorException('Assignment not created');
    }

    return {
      message: 'Assignment created successfully',
      success: true,
    };
  }

  async getAllAssignments(user_id: string, class_id: string) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');

    const existingClass = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
    });

    if (!existingClass) throw new NotFoundException('Class not found');

    const assignments = await this.prisma.assignment.findMany({
      where: { class_id: class_id },
      select: {
        id: true,
        title: true,
        description: true,
        submission_date: true,
        _count: {
          select: {
            submissions: true,
            grades: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const now = Date.now();

    const data = assignments.map(({ _count, ...assignment }) => {
      // Due days calculation
      const submissionDate = new Date(assignment.submission_date).getTime();
      const diffInTime = submissionDate - now;
      const due_days = Math.ceil(diffInTime / (1000 * 60 * 60 * 24));

      return {
        ...assignment,
        due_days: due_days < 0 ? 0 : due_days,
        submissions: _count.submissions,
        grades: _count.grades,
      };
    });

    return {
      message: 'Assignments retrieved successfully',
      success: true,
      data,
    };
  }

  async getAssignmentById(user_id: string, assignment_id: string) {
    if (!user_id) {
      return { message: 'Unauthorized', success: false };
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignment_id },
      select: {
        id: true,
        title: true,
        description: true,
        attachments: true,
        submission_date: true,
        total_marks: true,
        class: {
          select: {
            id: true,
            module: {
              select: {
                course: {
                  select: {
                    instructor: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            submissions: true,
            grades: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const average_score = await this.prisma.assignmentGrade.aggregate({
      _avg: {
        grade_number: true,
      },
      where: {
        assignment_id
      }
    });

    return {
      message: 'Assignment retrieved successfully',
      success: true,
      data: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        attachments: assignment.attachments.map((attachment) => {
          return {
            file_name: attachment.file_name,
            file_path: attachment.file_path ? SazedStorage.url(attachment.file_path) : null,
            mime_type: attachment.mime_type,
          };
        }),
        submission_date: assignment.submission_date,
        total_marks: assignment.total_marks,
        class_id: assignment.class.id,
        instructor: {
          id: assignment.class.module.course.instructor.id,
          name: assignment.class.module.course.instructor.name,
        },
        submissions: assignment._count.submissions,
        grades: assignment._count.grades,
        average_score: average_score._avg.grade_number ?? 0,
      },
    };

  }

  async updateAssignment(
    user_id: string,
    assignment_id: string,
    updateAssignmentDto: any,
    attachments: Express.Multer.File[],
  ) {
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }
    const attachmentsInput: Prisma.AttachmentCreateInput[] = [];

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignment_id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        const filename = SazedStorage.generateFileName(file.originalname);
        const objectKey = `${appConfig().storageUrl.assignment}/${filename}`;
        await SazedStorage.put(objectKey, file.buffer);

        attachmentsInput.push({
          file_name: filename,
          file_path: objectKey,
          mime_type: file.mimetype,
          size_bytes: file.size,
        });
      }
    }

    const updatedAssignment = await this.prisma.assignment.update({
      where: { id: assignment_id },
      data: {
        title: updateAssignmentDto.title || assignment.title,
        description:
          updateAssignmentDto.description || assignment.description,
        attachments: {
          updateMany: {
            where: {
              assignment_id: assignment_id,
            },
            data: attachmentsInput,
          },
        },
        submission_date:
          updateAssignmentDto.submission_date || assignment.submission_date,
        total_marks: updateAssignmentDto.total_marks || assignment.total_marks,
      },
    });

    if (!updatedAssignment) {
      throw new InternalServerErrorException('Failed to update assignment');
    }

    return {
      message: 'Assignment updated successfully',
      success: true,
    };
  }

  async deleteAssignment(user_id: string, assignment_id: string) {
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignment_id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    await this.prisma.assignment.delete({
      where: { id: assignment_id },
    });
    return {
      message: 'Assignment deleted successfully',
      success: true,
    };

  }

  async getAllAssignmentsSubmissions(user_id: string, assignment_id: string, query: GetAllAssignmentQueryDto) {

    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignment_id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const { status, search, page = 1, limit = 10 } = query

    const where: Prisma.AssignmentSubmissionWhereInput = {
      assignment_id: assignment_id,
    };

    if (status) {
      where.status = status;
    }
    if (search)
      where.OR = [
        { description: { contains: search } },
        { student: { name: { contains: search } } },
        { student: { email: { contains: search } } },
        { student: { phone_number: { contains: search } } },
      ]

    const submissions = await this.prisma.assignmentSubmission.findMany({
      where,
      select: {
        id: true,
        description: true,
        submitted_at: true,
        attachments: {
          select: {
            file_name: true,
            file_path: true,
            mime_type: true,
          },
        },

        assignment_id: true,

        grades: {
          select: {
            id: true,
            feedback: true,
            grade: true,
            grade_number: true,
          },
          take: 1,
          orderBy: {
            id: 'desc',
          },
        },
        student: {
          select: { id: true, name: true, avatar: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        submitted_at: 'desc',
      },
    });

    const total = await this.prisma.assignmentSubmission.count({
      where,
    });

    return {
      message: 'Submissions retrieved successfully',
      success: true,
      data: submissions.map((submission) => {
        const grade = submission?.grades?.[0] || null;
        delete submission.grades;
        return {
          id: submission.id,
          description: submission?.description,
          submitted_at: submission?.submitted_at,
          attachments: submission?.attachments?.map((attachment) => {
            return {
              file_name: attachment.file_name,
              file_path: attachment.file_path ? SazedStorage.url(attachment.file_path) : null,
              mime_type: attachment.mime_type,
            };
          }),

          student: {
            ...submission.student,
            avatar: submission.student?.avatar ? SazedStorage.url(submission.student?.avatar) : null,
          },
          grade
        };
      }),
      meta_data: {
        total,
        page,
        limit,
        search,
        status
      }
    };

  }

  async gradeSubmission(
    user_id: string,
    submission_id: string,
    gradeAssignmentDto: GradeAssignmentDto,
  ) {

    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submission_id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: submission.assignment_id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (gradeAssignmentDto.grade_number > assignment.total_marks) {
      throw new UnprocessableEntityException('Grade number exceeds total marks of the assignment');
    }

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
      gradeAssignmentDto.grade_number,
      assignment.total_marks,
    );

    const grade = await this.prisma.assignmentSubmission.update({
      where: { id: submission_id },
      data: {
        status: "GRADED",
        grades: {
          create: {
            feedback: gradeAssignmentDto.feedback,
            grade: gradeAssignmentDto.grade || gradeLetter || 'F',
            grade_number: gradeAssignmentDto.grade_number || 0,
            graded_by: "TEACHER",
            assignment: { connect: { id: submission.assignment_id } },
            creator: { connect: { id: user_id } },

          }
        }
      },
    });

    if (!grade) {
      throw new InternalServerErrorException('Error grading submission');
    }

    return {
      message: 'Submission graded successfully',
      success: true,
    };

  }

  //
  //-=------------------------------ end of assignment Management -------------------------------
  //

  //
  //------------------------------- Assets Management -------------------------------
  async uploadClassAsset(
    user_id: string,
    class_id: string,
    files: Express.Multer.File[],
  ) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');
    if (!files || files.length === 0) throw new UnprocessableEntityException('No files uploaded');

    const existingClass = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
    });

    if (!existingClass) throw new NotFoundException('Class not found');

    const uploadPromises = files.map(async (file) => {
      try {
        const filename = SazedStorage.generateFileName(file.originalname);
        const objectKey = `${appConfig().storageUrl.class_assets}/${filename}`;

        await SazedStorage.put(objectKey, file);

        let fileType: AttachmentType = 'FILE';
        if (file.mimetype.startsWith('video/')) fileType = 'VIDEO';
        else if (file.mimetype.startsWith('image/')) fileType = 'IMAGE';

        return {
          file_name: filename,
          type: fileType,
          file_path: objectKey,
          mime_type: file.mimetype,
          size_bytes: BigInt(file.size),
        };
      } catch (error) {
        console.error(`Failed to upload ${file.originalname}:`, error);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const attachmentsData = results.filter((item) => item !== null);

    if (attachmentsData.length === 0) {
      throw new InternalServerErrorException('Failed to upload any class assets');
    }


    await this.prisma.moduleClass.update({
      where: { id: class_id },
      data: {
        class_assets: {
          create: attachmentsData,
        },
      },
    });

    return {
      message: `${attachmentsData.length} assets uploaded successfully`,
      success: true,
    }
  }

  async getClassAssets(user_id: string, class_id: string) {

    if (!user_id) throw new UnauthorizedException('Unauthorized');

    const existingClass = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
    });

    if (!existingClass) throw new NotFoundException('Class not found');

    const assets = await this.prisma.attachment.findMany({
      where: { class_id },
      select: {
        id: true,
        type: true,
        file_path: true,
        file_name: true,
        mime_type: true,
      },
    });

    return {
      message: 'Class assets fetched successfully',
      success: true,
      data: {
        videos: assets.filter((a) => a.type === 'VIDEO').map((a) => {
          return {
            id: a.id,
            type: a.type,
            file_path: SazedStorage.url(a.file_path),
            file_name: a.file_name,
            mime_type: a.mime_type,
          };
        }),
        files: assets.filter((a) => a.type !== 'VIDEO').map((a) => {
          return {
            id: a.id,
            type: a.type,
            file_path: SazedStorage.url(a.file_path),
            file_name: a.file_name,
            mime_type: a.mime_type,
          };
        }),
      },
    };

  }

  async deleteClassAsset(user_id: string, asset_id: string) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');

    const asset = await this.prisma.attachment.findUnique({
      where: { id: asset_id },
      include: {
        class: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!asset) throw new NotFoundException('Asset not found');

    if (asset.class.module.course.instructor_id !== user_id) {
      throw new ForbiddenException('You are not the instructor of this course');
    }

    await SazedStorage.delete(asset.file_path);

    await this.prisma.attachment.delete({
      where: { id: asset_id },
    });

    return {
      message: 'Asset deleted successfully',
      success: true,
    };
  }
}
