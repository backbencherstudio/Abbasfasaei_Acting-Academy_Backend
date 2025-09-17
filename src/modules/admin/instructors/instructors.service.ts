import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client'; // Import for Decimal
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class InstructorsService {
  constructor(private prisma: PrismaService) {}

  async getAllTeachers() {
    return await this.prisma.user.findMany({
      where: {
        deleted_at: null,
        role_users: {
          some: { role: { name: { equals: 'TEACHER', mode: 'insensitive' } } },
        },
      },
      orderBy: { created_at: 'desc' },
    });
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
      const existingCourse = await this.prisma.course.findUnique({
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
        const hashedPassword = await bcrypt.hash('defaultPassword123', 10);
        const username = createTeacherDto.email.split('@')[0];

        teacher = await this.prisma.user.create({
          data: {
            name: createTeacherDto.name,
            email: createTeacherDto.email,
            username: username,
            password: hashedPassword,
            phone_number: createTeacherDto.phone_number,
            type: createTeacherDto.teacherType,
            status: 1,
            experience_level: createTeacherDto.experienceLevel,
            email_verified_at: new Date(),
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
        teacher = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            type: createTeacherDto.teacherType,
            experience_level: createTeacherDto.experienceLevel,
            phone_number: createTeacherDto.phone_number,
          },
        });
        // Ensure the existing user has TEACHER role attached
        const alreadyTeacher = await this.prisma.roleUser.findFirst({
          where: {
            user_id: existingUser.id,
            role: { name: { equals: 'TEACHER', mode: 'insensitive' } },
          },
        });
        if (!alreadyTeacher) {
          await this.prisma.roleUser.create({
            data: { user_id: existingUser.id, role_id: teacherRole.id },
          });
        }
      }

      // 5. Check if course already has a different instructor
      if (
        existingCourse.instructorId &&
        existingCourse.instructorId !== teacher.id
      ) {
        return {
          success: false,
          message: 'Course already assigned to another teacher',
        };
      }

      const courseUpdate = await this.prisma.course.update({
        where: { id: createTeacherDto.courseId },
        data: {
          instructorId: teacher.id,
        },
      });

      return {
        success: true,
        message: existingUser
          ? 'Teacher assigned to course successfully'
          : 'Teacher created and assigned to course successfully',
        data: { teacher, course: courseUpdate },
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
            some: { role: { name: { equals: 'TEACHER', mode: 'insensitive' } } },
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

  async getTeacherDetails(userId: string) {
    const teacherDetails = await this.prisma.user.findFirst({
      where: {
        id: userId,
        role_users: {
          some: { role: { name: { equals: 'TEACHER', mode: 'insensitive' } } },
        },
      },
    });

    const students = await this.prisma.user.findMany({
      where: {
        Enrollment: {
          some: {
            course: {
              instructorId: userId,
            },
          },
        },
      },
    });

    const modules = await this.prisma.courseModule.findMany({
      where: {
        course: {
          instructorId: userId,
        },
      },
      include: {
        classes: true,
      },
    });

    const classes = await this.prisma.moduleClass.findMany({
      where: {
        module: {
          course: {
            instructorId: userId,
          },
        },
      },
      include: {
        assignments: true,
        classAssets: true,
      },
    });

    return { teacherDetails, classes, students, modules };
  }
}

/*



*/
