import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getAllAttendance(query?: {
    status?: string;
    date?: string;
    classId?: string;
    courseId?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 10));
    const skip = (page - 1) * limit;
    const normalizedStatus = query?.status
      ? String(query.status).toUpperCase()
      : undefined;
    const normalizedSearch = (query?.search || '').trim().toLowerCase();
    let scopedClassIds: string[] = [];
    let scopedCourseId: string | undefined;
    let dateRange: { gte: Date; lt: Date } | undefined;

    if (normalizedStatus) {
      const allowedStatuses = Object.values(AttendanceStatus);
      if (!allowedStatuses.includes(normalizedStatus as AttendanceStatus)) {
        return {
          success: false,
          message: `Invalid status filter. Allowed values: ${allowedStatuses.join(', ')}`,
        };
      }
    }

    if (query?.date) {
      const parsedDate = new Date(query.date);
      if (Number.isNaN(parsedDate.getTime())) {
        return {
          success: false,
          message: 'Invalid date filter',
        };
      }
      const year = parsedDate.getFullYear();
      const month = parsedDate.getMonth();

      dateRange = {
        gte: new Date(year, month, 1),
        lt: new Date(year, month + 1, 1),
      };
    }

    if (query?.classId) {
      const moduleClass = await this.prisma.moduleClass.findUnique({
        where: { id: query.classId },
        include: {
          module: {
            select: {
              courseId: true,
            },
          },
        },
      });

      if (!moduleClass) {
        return {
          success: false,
          message: 'Class not found',
        };
      }

      scopedClassIds = [query.classId];
      scopedCourseId = moduleClass.module.courseId;
    }

    if (query?.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: query.courseId },
        select: { id: true },
      });

      if (!course) {
        return {
          success: false,
          message: 'Course not found',
        };
      }

      const classes = await this.prisma.moduleClass.findMany({
        where: {
          module: {
            courseId: query.courseId,
          },
        },
        select: { id: true },
      });

      scopedClassIds = classes.map((c) => c.id);
      scopedCourseId = query.courseId;
    }

    const isOverall = !scopedCourseId && scopedClassIds.length === 0;

    const studentsScope = isOverall
      ? await this.prisma.user.findMany({
          where: {
            deleted_at: null,
            role_users: {
              some: {
                role: {
                  name: {
                    equals: 'STUDENT',
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
          },
        })
      : await this.prisma.enrollment.findMany({
          where: {
            courseId: scopedCourseId,
          },
          select: {
            user_id: true,
            full_name: true,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                avatar: true,
              },
            },
          },
        });

    const uniqueStudents = new Map<
      string,
      {
        id: string;
        name?: string | null;
        username?: string | null;
        email?: string | null;
        avatar?: string | null;
        full_name?: string | null;
      }
    >();

    for (const row of studentsScope as any[]) {
      const id = row.user?.id || row.id || row.user_id;
      if (!id) continue;
      if (!uniqueStudents.has(id)) {
        uniqueStudents.set(id, {
          id,
          name: row.user?.name ?? row.name ?? null,
          username: row.user?.username ?? row.username ?? null,
          email: row.user?.email ?? row.email ?? null,
          avatar: row.user?.avatar ?? row.avatar ?? null,
          full_name: row.full_name ?? null,
        });
      }
    }

    const scopedStudentIds = Array.from(uniqueStudents.keys());

    const attendanceWhere: any = {
      ...(scopedStudentIds.length ? { student_id: { in: scopedStudentIds } } : {}),
      ...(scopedClassIds.length ? { class_id: { in: scopedClassIds } } : {}),
      ...(dateRange ? { attended_at: dateRange } : {}),
    };

    const attendanceRows = scopedStudentIds.length
      ? await this.prisma.attendance.findMany({
          where: attendanceWhere,
          include: {
            class: {
              select: {
                id: true,
                class_title: true,
                class_time: true,
                module: {
                  select: {
                    id: true,
                    module_title: true,
                    course: {
                      select: {
                        id: true,
                        title: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ attended_at: 'desc' }, { created_at: 'desc' }],
        })
      : [];

    const attendanceByStudent = new Map<string, any[]>();
    for (const row of attendanceRows) {
      const items = attendanceByStudent.get(row.student_id) || [];
      items.push(row);
      attendanceByStudent.set(row.student_id, items);
    }

    const studentStatusRows = scopedStudentIds.map((studentId) => {
      const student = uniqueStudents.get(studentId)!;
      const rows = attendanceByStudent.get(studentId) || [];
      const latest = rows[0];
      const presentClasses = rows.filter(
        (r) => r.status === AttendanceStatus.PRESENT,
      ).length;
      const missedClasses = rows.filter(
        (r) => r.status === AttendanceStatus.ABSENT,
      ).length;
      const status = latest?.status || 'ABSENT';

      return {
        studentId: student.id,
        studentName:
          student.full_name || student.name || student.username || 'Unknown',
        studentCode: student.username || student.id,
        email: student.email || null,
        avatar: student.avatar || null,
        date: latest?.attended_at || latest?.created_at || null,
        status,
        attendanceBy: latest?.attendance_by || '-',
        classId: latest?.class?.id || query?.classId || null,
        classTitle: latest?.class?.class_title || null,
        classTime: latest?.class?.class_time || null,
        courseId:
          latest?.class?.module?.course?.id || scopedCourseId || query?.courseId,
        courseTitle: latest?.class?.module?.course?.title || null,
        presentClasses,
        missedClasses,
        totalClasses: presentClasses + missedClasses,
      };
    });

    const presentStudents = studentStatusRows.filter(
      (s) => s.status === AttendanceStatus.PRESENT,
    ).length;
    const missedStudents = studentStatusRows.filter(
      (s) => s.status === AttendanceStatus.ABSENT,
    ).length;
    const othersStudents = Math.max(
      0,
      studentStatusRows.length - presentStudents - missedStudents,
    );
    const attendanceRate =
      studentStatusRows.length > 0
        ? Number(((presentStudents / studentStatusRows.length) * 100).toFixed(2))
        : 0;

    let finalList = studentStatusRows;
    if (normalizedStatus) {
      finalList = finalList.filter((item) => item.status === normalizedStatus);
    }

    if (normalizedSearch) {
      finalList = finalList.filter((item) => {
        const haystack = [
          item.studentId,
          item.studentName,
          item.studentCode,
          item.email,
          item.classTitle,
          item.courseTitle,
          item.attendanceBy,
          item.status,
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());

        return haystack.some((value) => value.includes(normalizedSearch));
      });
    }

    const total = finalList.length;
    const pagedList = finalList.slice(skip, skip + limit);

    return {
      success: true,
      message: 'Attendance fetched successfully',
      data: pagedList,
      card: {
        attendanceRate,
        missedClasses: missedStudents,
        totalClasses: studentStatusRows.length,
        presentClasses: presentStudents,
        others: othersStudents,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        search: normalizedSearch || undefined,
      },
    };
  }

  async markManualAttendance(
    body: {
      classId?: string;
      studentId?: string;
      status?: string;
      attendedAt?: string;
    },
    actorUserId: string,
  ) {
    const classId = (body?.classId || '').trim();
    const studentId = (body?.studentId || '').trim();

    if (!classId) {
      throw new BadRequestException('Class ID is required');
    }

    if (!studentId) {
      throw new BadRequestException('Student ID is required');
    }

    if (!actorUserId) {
      throw new BadRequestException('User ID is required');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        id: true,
        role_users: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!actor) {
      throw new NotFoundException('User not found');
    }

    const roleNames = (actor.role_users || [])
      .map((ru) => ru?.role?.name)
      .filter(Boolean)
      .map((name) => String(name).toLowerCase());

    const isAdmin =
      roleNames.includes('admin') || roleNames.includes('su_admin');
    const isTeacher = roleNames.includes('teacher');

    if (!isAdmin && !isTeacher) {
      throw new ForbiddenException(
        'Only teacher, admin, or super admin can mark manual attendance',
      );
    }

    const moduleClass = await this.prisma.moduleClass.findUnique({
      where: { id: classId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!moduleClass) {
      throw new NotFoundException('Class not found');
    }

    if (
      isTeacher &&
      !isAdmin &&
      moduleClass.module.course.instructorId !== actorUserId
    ) {
      throw new ForbiddenException('You are not assigned to this class/course');
    }

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        role_users: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const isStudent = (student.role_users || []).some(
      (ru) => ru?.role?.name?.toUpperCase() === 'STUDENT',
    );

    if (!isStudent) {
      throw new BadRequestException('Selected user is not a student');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        user_id: studentId,
        course: {
          modules: {
            some: {
              classes: {
                some: {
                  id: classId,
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    if (!enrollment) {
      throw new ForbiddenException('Student is not enrolled in this class course');
    }

    const normalizedStatus = (body?.status || 'PRESENT').toUpperCase();
    const allowedStatuses = Object.values(AttendanceStatus);
    if (!allowedStatuses.includes(normalizedStatus as AttendanceStatus)) {
      throw new BadRequestException(
        `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
      );
    }

    let attendedAt: Date | null = null;
    if (body?.attendedAt) {
      const parsedDate = new Date(body.attendedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestException('Invalid attendedAt date');
      }
      attendedAt = parsedDate;
    } else if (normalizedStatus === AttendanceStatus.PRESENT) {
      attendedAt = new Date();
    }

    const existingAttendance = await this.prisma.attendance.findFirst({
      where: {
        class_id: classId,
        student_id: studentId,
      },
    });

    if (existingAttendance) {
      if (existingAttendance.status === normalizedStatus) {
        return {
          success: true,
          message: `Attendance already marked as ${normalizedStatus}`,
          data: existingAttendance,
        };
      }

      const updated = await this.prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: normalizedStatus as AttendanceStatus,
          attended_at:
            normalizedStatus === AttendanceStatus.PRESENT ? attendedAt : null,
          attendance_by: 'MANUAL',
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'Attendance updated manually',
        data: updated,
      };
    }

    const created = await this.prisma.attendance.create({
      data: {
        class_id: classId,
        student_id: studentId,
        status: normalizedStatus as AttendanceStatus,
        attended_at:
          normalizedStatus === AttendanceStatus.PRESENT ? attendedAt : null,
        attendance_by: 'MANUAL',
      },
    });

    return {
      success: true,
      message: 'Attendance marked manually',
      data: created,
    };
  }

  async generateClassQR(classId: string, teacherId: string) {
    if (!classId) {
      throw new BadRequestException('Class ID is required');
    }

    if (!teacherId) {
      throw new BadRequestException('Teacher ID is required');
    }

    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        name: true,
        role_users: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const isTeacher = teacher.role_users.some(
      (roleUser) => roleUser.role?.name?.toUpperCase() === 'TEACHER',
    );

    if (!isTeacher) {
      throw new ForbiddenException('Only teachers can generate QR codes');
    }

    const moduleClass = await this.prisma.moduleClass.findUnique({
      where: { id: classId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!moduleClass) {
      throw new NotFoundException('Class not found');
    }

    if (moduleClass.module.course.instructorId !== teacherId) {
      throw new ForbiddenException('You are not assigned to this course/class');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Create QR session
    const qrSession = await this.prisma.qRAttendanceSession.create({
      data: {
        token,
        class_id: classId,
        created_by: teacherId,
        expires_at: expiresAt,
        is_active: true,
      },
      include: {
        class: {
          select: {
            id: true,
            class_title: true,
            class_time: true,
          },
        },
      },
    });

    // Generate QR code data
    const qrData = JSON.stringify({
      version: '1.0',
      type: 'attendance',
      classId,
      token,
      expires: expiresAt.toISOString(),
    });

    const qrCodeImage = await QRCode.toDataURL(qrData);

    return {
      qrCodeImage,
      token,
      sessionId: qrSession.id,
      expiresAt,
      class: qrSession.class,
    };
  }
}
