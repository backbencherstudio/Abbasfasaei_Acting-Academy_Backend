import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client'; // Import for Decimal
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';
import { UserStatus } from 'src/common/constants/user-status.enum';

@Injectable()
export class InstructorsService {
  constructor(private prisma: PrismaService) {}

  async getAllTeachers(query?: {
    search?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    page?: string;
    limit?: string;
    teacherId?: string;
  }) {
    const where: Prisma.UserWhereInput = {
      deleted_at: null,
      role_users: {
        some: { role: { name: { equals: 'TEACHER', mode: 'insensitive' } } },
      },
    };

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone_number: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query?.status) {
      where.status =
        query.status == 'ACTIVE' ? UserStatus.ACTIVE : UserStatus.DEACTIVATED;
    }

    if (query?.teacherId) {
      where.id = query.teacherId;
    }

    const page = parseInt(query?.page) || 1;
    const limit = parseInt(query?.limit) || 10;
    const skip = (page - 1) * limit;

    const [teachers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
          avatar: true,
          experience: true,
          status: true,
          joined_at: true,
          created_at: true,
          _count: {
            select: {
              assigned_courses: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      success: true,
      message: 'Teachers fetched successfully',
      data: teachers.map((t) => {
        const { _count, ...teacherData } = t;
        return {
          ...teacherData,
          avatar: t.avatar
            ? t.avatar.startsWith('http')
              ? t.avatar
              : SazedStorage.url(
                  `${appConfig().storageUrl.avatar.replace(/\/+$/, '')}/${String(t.avatar).replace(/^\/+/, '')}`,
                )
            : null,
          status: t.status == UserStatus.ACTIVE ? 'ACTIVE' : 'INACTIVE',
          class_count: _count.assigned_courses,
        };
      }),
      meta_data: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async addTeacher(createTeacherDto: CreateTeacherDto) {
    try {
      // Ensure TEACHER role exists or create it
      let teacherRole = await this.prisma.role.findFirst({
        where: { name: { equals: 'TEACHER', mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (!teacherRole) {
        teacherRole = await this.prisma.role.create({
          data: { name: 'TEACHER', title: 'Teacher' },
          select: { id: true, name: true },
        });
      }
      let existingCourse = null;
      if (createTeacherDto.courseId) {
        existingCourse = await this.prisma.course.findUnique({
          where: {
            id: createTeacherDto.courseId,
          },
        });

        if (!existingCourse) {
          return {
            success: false,
            message: 'Course not found',
          };
        }
      }

      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: createTeacherDto.email },
            { phone_number: createTeacherDto.phone_number },
          ],
          deleted_at: null,
        },
      });

      let teacher;

      if (!existingUser) {
        const passwordToUse = createTeacherDto.password || 'teacher123';
        const hashedPassword = await bcrypt.hash(passwordToUse, 10);
        const username = createTeacherDto.email.split('@')[0];

        teacher = await this.prisma.user.create({
          data: {
            name: createTeacherDto.name,
            email: createTeacherDto.email,
            username: username,
            password: hashedPassword,
            phone_number: createTeacherDto.phone_number,
            type: 'teacher',
            status: UserStatus.ACTIVE,
            experience: createTeacherDto.experienceLevel,
            joined_at: createTeacherDto.joined_at,
          },
        });
        // Attach TEACHER role to the newly created user
        await this.prisma.roleUser.create({
          data: {
            user_id: teacher.id,
            role_id: teacherRole.id,
          },
        });
      } else {
        // teacher = await this.prisma.user.update({
        //   where: { id: existingUser.id },
        //   data: {
        //     type: createTeacherDto.teacherType,
        //     experience_level: createTeacherDto.experienceLevel,
        //     phone_number: createTeacherDto.phone_number,
        //     joined_at: createTeacherDto.joined_at,
        //   },
        // });
        // // Ensure the existing user has TEACHER role attached
        // const alreadyTeacher = await this.prisma.roleUser.findFirst({
        //   where: {
        //     user_id: existingUser.id,
        //     role: { name: { equals: 'TEACHER', mode: 'insensitive' } },
        //   },
        // });
        // if (!alreadyTeacher) {
        //   await this.prisma.roleUser.create({
        //     data: { user_id: existingUser.id, role_id: teacherRole.id },
        //   });
        // }
        throw new BadRequestException(
          'Teacher already exists with this email or phone number',
        );
      }

      // 5. Check if course already has a different instructor
      let courseUpdate = null;
      if (existingCourse) {
        if (
          existingCourse.instructor_id &&
          existingCourse.instructor_id !== teacher.id
        ) {
          return {
            success: false,
            message: 'Course already assigned to another teacher',
          };
        }

        courseUpdate = await this.prisma.course.update({
          where: { id: createTeacherDto.courseId },
          data: {
            instructor_id: teacher.id,
          },
        });
      }

      return {
        success: true,
        message: existingUser
          ? 'Teacher updated successfully' +
            (courseUpdate ? ' and assigned to course' : '')
          : 'Teacher created successfully' +
            (courseUpdate ? ' and assigned to course' : ''),
        // data: { teacher, course: courseUpdate },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateTeacher(teacherId: string, updateTeacherDto: UpdateTeacherDto) {
    try {
      // 1. Check if teacher exists
      const existingTeacher = await this.prisma.user.findFirst({
        where: {
          id: teacherId,
          deleted_at: null,
          role_users: {
            some: {
              role: { name: { equals: 'TEACHER', mode: 'insensitive' } },
            },
          },
        },
      });

      if (!existingTeacher) {
        return {
          success: false,
          message: 'Teacher not found',
        };
      }

      // 2. Prepare update data (PartialType handles the optional nature)
      const updateData: Prisma.UserUpdateInput = {
        ...updateTeacherDto,
      };

      // 3. Update the teacher
      const updatedTeacher = await this.prisma.user.update({
        where: { id: teacherId },
        data: updateData,
      });

      return {
        success: true,
        message: 'Teacher updated successfully',
        data: updatedTeacher,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Teacher not found',
      };
    }
  }

  // async getTeacherDetails(userId: string) {
  //   const [teacherDetails, classes, students, modules] = await Promise.all([
  //     this.prisma.user.findFirst({
  //       where: {
  //         id: userId,
  //         role_users: {
  //           some: {
  //             role: { name: { equals: 'TEACHER', mode: 'insensitive' } },
  //           },
  //         },
  //       },
  //       select: {
  //         id: true,
  //         name: true,
  //         email: true,
  //         phone_number: true,
  //         avatar: true,
  //         experience_level: true,
  //         status: true,
  //         joined_at: true,
  //         created_at: true,
  //       },
  //     }),
  //     this.prisma.course.findMany({
  //       where: {
  //         instructorId: userId,
  //       },
  //     }),
  //     this.prisma.user.findMany({
  //       where: {
  //         Enrollment: {
  //           some: {
  //             course: {
  //               instructorId: userId,
  //             },
  //           },
  //         },
  //       },
  //     }),
  //     this.prisma.courseModule.findMany({
  //       where: {
  //         course: {
  //           instructorId: userId,
  //         },
  //       },
  //       include: {
  //         course: true,
  //       },
  //     }),
  //   ]);

  //   return {
  //     success: true,
  //     message: 'Teacher details fetched successfully',
  //     data: {
  //       teacher_details: {
  //         ...teacherDetails,
  //         avatar: teacherDetails?.avatar
  //           ? SazedStorage.url(
  //               appConfig().storageUrl.avatar + teacherDetails.avatar,
  //             )
  //           : null,
  //         status: teacherDetails.status == 1 ? 'ACTIVE' : 'INACTIVE',
  //       },
  //       classes,
  //       students,
  //       modules,
  //     },
  //   };
  // }
  async getTeacherDetails(userId: string) {
    const teacherDetails = await this.prisma.user.findFirst({
      where: {
        id: userId,
        role_users: {
          some: {
            role: { name: { equals: 'TEACHER', mode: 'insensitive' } },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        avatar: true,
        experience: true,
        status: true,
        joined_at: true,
        created_at: true,
        assigned_courses: {
          select: {
            id: true,
            title: true,
            course_overview: true,
            fee_pence: true,
            status: true,
            duration: true,
            start_date: true,
            seat_capacity: true,
            created_at: true,
            updated_at: true,
            _count: {
              select: {
                enrollments: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      message: 'Teacher details fetched successfully',
      data: {
        ...teacherDetails,
        avatar: teacherDetails?.avatar
          ? teacherDetails.avatar.startsWith('http')
            ? teacherDetails.avatar
            : SazedStorage.url(
                `${appConfig().storageUrl.avatar.replace(/\/+$/, '')}/${String(teacherDetails.avatar).replace(/^\/+/, '')}`,
              )
          : null,
        status:
          teacherDetails.status == UserStatus.ACTIVE ? 'ACTIVE' : 'INACTIVE',
      },
    };
  }
}
