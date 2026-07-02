import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateCourseDto, CreateEnrollmentDto } from './dto/create-course.dto';
import {
  UpdateAttendanceDto,
  UpdateCourseDto,
  UpdateEnrollmentDto,
} from './dto/update-course.dto';
import {
  CreateModuleDto,
  CreateClassDto,
  CreateAssignmentDto,
  GradeAssignmentDto,
} from './dto/create-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateModuleDto, UpdateClassDto } from './dto/update-course.dto';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { Role } from 'src/common/guard/role/role.enum';
import {
  AttendanceQueryDto,
  GetAllAssignmentQueryDto,
  GetAllCourseQueryDto,
  GetAllEnrolledUserQueryDto,
} from './dto/query-course.dto';
import {
  AssignmentSubmissionStatus,
  AttachmentType,
  AttendanceStatus,
  CourseStatus,
  EnrollmentStatus,
  EnrollmentStep,
  EnrollmentType,
  OrderItemType,
  OrderStatus,
  PaymentMode,
  Prisma,
} from '@prisma/client';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private prisma: PrismaService) {}

  async makeEnrolment(
    user_id: string,
    course_id: string,
    createEnrollmentDto: CreateEnrollmentDto,
  ) {
    if (!user_id) throw new UnauthorizedException('Please login first');

    const course = await this.prisma.course.findUnique({
      where: { id: course_id, status: CourseStatus.ACTIVE },
    });

    const { student_id, rules_document, contract_document, ...rest } =
      createEnrollmentDto;

    if (!rules_document)
      throw new BadRequestException('Rules documents are required');
    if (!contract_document)
      throw new BadRequestException('Contract documents are required');

    if (!course)
      throw new NotFoundException('Course not found or not enrollable');

    const alreadyEnrolled = await this.prisma.enrollment.findFirst({
      where: { user_id: student_id, course_id },
    });
    if (alreadyEnrolled)
      throw new ConflictException('Student already enrolled in this course');

    const rulesDocumentFilename = NajimStorage.generateFileName(
      rules_document.originalname,
    );
    const contractDocumentFilename = NajimStorage.generateFileName(
      contract_document.originalname,
    );
    const rulesDocumentObjectKey =
      appConfig().storageUrl.enrollment + '/' + rulesDocumentFilename;
    const contractDocumentObjectKey =
      appConfig().storageUrl.enrollment + '/' + contractDocumentFilename;

    const storedRulesDocument = await NajimStorage.put(
      rulesDocumentObjectKey,
      rules_document.buffer,
      { contentType: rules_document.mimetype },
    );
    if (!storedRulesDocument) {
      throw new InternalServerErrorException('Failed to store rules documents');
    }
    const storedContractFile = await NajimStorage.put(
      contractDocumentObjectKey,
      contract_document.buffer,
      { contentType: contract_document.mimetype },
    );
    if (!storedContractFile) {
      throw new InternalServerErrorException(
        'Failed to store contract documents',
      );
    }

    const enrollment = await this.prisma.$transaction(async (tx) => {
      const orderNumber = `MAN-ENR-${Date.now()}-${Math.floor(
        Math.random() * 1000,
      )}`;
      const totalAmount = Number(course.fee_pence ?? 0);
      const isFree = rest.enrollment_type === EnrollmentType.FREE;

      const order = await tx.order.create({
        data: {
          order_number: orderNumber,
          user_id: student_id,
          item_type: OrderItemType.COURSE_ENROLLMENT,
          payment_mode: isFree ? PaymentMode.FREE : PaymentMode.MANUAL,
          status: isFree ? OrderStatus.PAID : OrderStatus.PENDING,
          subtotal_amount: isFree ? 0 : totalAmount,
          total_amount: isFree ? 0 : totalAmount,
          paid_amount: 0,
          due_amount: isFree ? 0 : totalAmount,
          course_id,
          created_by_admin_id: user_id,
          notes: isFree
            ? `Free manual enrollment for ${course.title}`
            : `Manual enrollment for ${course.title}`,
        },
      });

      return tx.enrollment.create({
        data: {
          user_id: student_id,
          course_id,
          order_id: order.id,
          status: isFree ? EnrollmentStatus.ACTIVE : EnrollmentStatus.PENDING,
          step: isFree ? EnrollmentStep.COMPLETED : EnrollmentStep.PAYMENT,
          enrolled_by_admin_id: user_id,
          rules_regulations_accepted: true,
          digital_contract_accepted: true,
          ...rest,
          attachments: {
            create: [
              {
                file_name: rulesDocumentFilename,
                file_path: rulesDocumentObjectKey,
                type: AttachmentType.RULES_REGULATIONS,
                size_bytes: rules_document.size,
                mime_type: rules_document.mimetype,
              },
              {
                file_name: contractDocumentFilename,
                file_path: contractDocumentObjectKey,
                type: AttachmentType.DIGITAL_CONTRACT,
                size_bytes: contract_document.size,
                mime_type: contract_document.mimetype,
              },
            ],
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          date_of_birth: true,
          address: true,
          experience: true,
          status: true,
          step: true,
          admin_note: true,
          enrollment_type: true,
          user_id: true,

          course: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          order: {
            select: {
              id: true,
              order_number: true,
              status: true,
              subtotal_amount: true,
              total_amount: true,
              paid_amount: true,
              due_amount: true,
            },
          },
          attachments: {
            select: {
              id: true,
              file_name: true,
              file_path: true,
              type: true,
              mime_type: true,
            },
          },
        },
      });
    });
    return {
      success: true,
      message: 'Enrollment created successfully',
      data: {
        ...enrollment,
        attachments: enrollment.attachments.map((attachment) => ({
          ...attachment,
          file_path: attachment.file_path
            ? NajimStorage.url(attachment.file_path)
            : null,
        })),
      },
    };
  }

  async getEnrollmentDetails(enrollment_id: string) {
    if (!enrollment_id)
      throw new BadRequestException('Enrollment ID is required');

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollment_id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        date_of_birth: true,
        address: true,
        experience: true,
        status: true,
        step: true,
        admin_note: true,
        enrollment_type: true,
        user_id: true,
        course: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        order: {
          select: {
            id: true,
            order_number: true,
            status: true,
            subtotal_amount: true,
            total_amount: true,
            paid_amount: true,
            due_amount: true,
          },
        },
        attachments: {
          select: {
            id: true,
            file_name: true,
            file_path: true,
            type: true,
            mime_type: true,
          },
        },
      },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    return {
      success: true,
      message: 'Enrollment details fetched successfully',
      data: {
        ...enrollment,
        attachments: enrollment.attachments.map((attachment) => ({
          ...attachment,
          file_path: attachment.file_path
            ? NajimStorage.url(attachment.file_path)
            : null,
        })),
      },
    };
  }

  async updateEnrollment(
    admin_id: string,
    enrollment_id: string,
    updateEnrollmentDto: UpdateEnrollmentDto,
  ) {
    if (!admin_id) throw new UnauthorizedException('Please login first');
    if (!enrollment_id)
      throw new BadRequestException('Enrollment ID is required');

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollment_id },
      include: {
        course: { select: { id: true, title: true, fee_pence: true } },
        order: true,
        attachments: true,
      },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const { rules_document, contract_document, ...rest } = updateEnrollmentDto;

    const data: Prisma.EnrollmentUpdateInput = {
      ...rest,
      enrolled_by_admin_id: enrollment.enrolled_by_admin_id ?? admin_id,
    };

    const existingRulesDocument = enrollment?.attachments?.find(
      (attachment) => attachment?.type === AttachmentType.RULES_REGULATIONS,
    );
    const existingContractDocument = enrollment?.attachments?.find(
      (attachment) => attachment?.type === AttachmentType.DIGITAL_CONTRACT,
    );

    if (!existingRulesDocument && !rules_document) {
      throw new BadRequestException('Rules document is required');
    }
    if (!existingContractDocument && !contract_document) {
      throw new BadRequestException('Contract document is required');
    }
    if (rules_document) {
      const filename = NajimStorage.generateFileName(
        rules_document.originalname,
      );
      const objectKey = appConfig().storageUrl.enrollment + '/' + filename;
      if (existingRulesDocument?.file_path) {
        await NajimStorage.delete(existingRulesDocument.file_path);
      }
      await NajimStorage.put(objectKey, rules_document.buffer, {
        contentType: rules_document.mimetype,
      });
      await this.prisma.attachment.upsert({
        where: { id: existingRulesDocument?.id ?? '' },
        update: {
          file_name: filename,
          file_path: objectKey,
          size_bytes: rules_document.size,
          mime_type: rules_document.mimetype,
        },
        create: {
          enrollment_id: enrollment.id,
          file_name: filename,
          file_path: objectKey,
          type: AttachmentType.RULES_REGULATIONS,
          size_bytes: rules_document.size,
          mime_type: rules_document.mimetype,
        },
      });
    }
    if (contract_document) {
      const filename = NajimStorage.generateFileName(
        contract_document.originalname,
      );
      const objectKey = appConfig().storageUrl.enrollment + '/' + filename;
      if (existingContractDocument?.file_path) {
        await NajimStorage.delete(existingContractDocument.file_path);
      }
      await NajimStorage.put(objectKey, contract_document.buffer, {
        contentType: contract_document.mimetype,
      });
      await this.prisma.attachment.upsert({
        where: { id: existingContractDocument?.id ?? '' },
        update: {
          file_name: filename,
          file_path: objectKey,
          size_bytes: contract_document.size,
          mime_type: contract_document.mimetype,
        },
        create: {
          enrollment_id: enrollment.id,
          file_name: filename,
          file_path: objectKey,
          type: AttachmentType.DIGITAL_CONTRACT,
          size_bytes: contract_document.size,
          mime_type: contract_document.mimetype,
        },
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      let orderId = enrollment.order_id;
      const isFree =
        data.enrollment_type === EnrollmentType.FREE ||
        (!data.enrollment_type &&
          enrollment.enrollment_type === EnrollmentType.FREE);

      if (!orderId && enrollment.course) {
        const order = await tx.order.create({
          data: {
            order_number: `MAN-ENR-${Date.now()}-${Math.floor(
              Math.random() * 1000,
            )}`,
            user_id: enrollment.user_id,
            item_type: OrderItemType.COURSE_ENROLLMENT,
            payment_mode: isFree ? PaymentMode.FREE : PaymentMode.MANUAL,
            status: isFree ? OrderStatus.PAID : OrderStatus.PENDING,
            subtotal_amount: isFree
              ? 0
              : Number(enrollment.course.fee_pence ?? 0),
            total_amount: isFree ? 0 : Number(enrollment.course.fee_pence ?? 0),
            paid_amount: 0,
            due_amount: isFree ? 0 : Number(enrollment.course.fee_pence ?? 0),
            course_id: enrollment.course.id,
            created_by_admin_id: admin_id,
            notes: isFree
              ? `Free manual enrollment recovery for ${enrollment.course.title}`
              : `Manual enrollment recovery for ${enrollment.course.title}`,
          },
        });
        orderId = order.id;
      } else if (orderId) {
        if (isFree) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              payment_mode: PaymentMode.FREE,
              status: OrderStatus.PAID,
              subtotal_amount: 0,
              total_amount: 0,
              paid_amount: 0,
              due_amount: 0,
            },
          });
        } else {
          const currentOrder = await tx.order.findUnique({
            where: { id: orderId },
          });
          if (currentOrder && currentOrder.payment_mode === PaymentMode.FREE) {
            const courseFee = Number(enrollment.course?.fee_pence ?? 0);
            await tx.order.update({
              where: { id: orderId },
              data: {
                payment_mode: PaymentMode.MANUAL,
                status: OrderStatus.PENDING,
                subtotal_amount: courseFee,
                total_amount: courseFee,
                paid_amount: 0,
                due_amount: courseFee,
              },
            });
          }
        }
      }

      const finalStatus = isFree ? EnrollmentStatus.ACTIVE : data.status;
      const finalStep = isFree ? EnrollmentStep.COMPLETED : data.step;

      return tx.enrollment.update({
        where: { id: enrollment_id },
        data: {
          ...data,
          ...(finalStatus ? { status: finalStatus } : {}),
          ...(finalStep ? { step: finalStep } : {}),
          ...(orderId && !enrollment.order_id
            ? { order: { connect: { id: orderId } } }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          date_of_birth: true,
          address: true,
          experience: true,
          status: true,
          step: true,
          admin_note: true,
          enrollment_type: true,
          user_id: true,
          course: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          order: {
            select: {
              id: true,
              order_number: true,
              status: true,
              subtotal_amount: true,
              total_amount: true,
              paid_amount: true,
              due_amount: true,
            },
          },
          attachments: {
            select: {
              id: true,
              file_name: true,
              file_path: true,
              type: true,
              mime_type: true,
            },
          },
        },
      });
    });

    return {
      success: true,
      message: 'Enrollment updated successfully',
      data: {
        ...updated,
        attachments: updated.attachments.map((attachment) => ({
          ...attachment,
          file_path: attachment.file_path
            ? NajimStorage.url(attachment.file_path)
            : null,
        })),
      },
    };
  }

  async getAttendanceQR(class_id: string, user_id: string) {
    if (!class_id) throw new BadRequestException('Class ID is required');
    if (!user_id) throw new BadRequestException('User ID is required');

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: { id: true, type: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const moduleClass = await this.prisma.moduleClass.findFirst({
      where: {
        id: class_id,
        module: {
          course: {
            status: CourseStatus.ACTIVE,
            ...(user.type === Role.TEACHER && {
              instructor_id: user.id,
            }),
          },
        },
      },
      select: {
        id: true,
        start_at: true,
        end_at: true,
      },
    });

    if (!moduleClass) throw new NotFoundException('Class not found');

    const now = new Date();
    if (moduleClass.end_at && moduleClass.end_at <= now) {
      throw new BadRequestException('Class has already ended');
    }

    let qrSession = await this.prisma.qRAttendanceSession.findFirst({
      where: {
        class_id,
      },
      select: {
        id: true,
        qr_image: true,
        token: true,
        class_id: true,
      },
    });

    if (!qrSession) {
      qrSession = await this.prisma.qRAttendanceSession.create({
        data: {
          class_id,
          created_by: user_id,
          token: crypto.randomBytes(32).toString('hex'),
          expires_at: moduleClass.end_at || undefined,
          is_active: true,
        },
        select: {
          id: true,
          token: true,
          class_id: true,
          qr_image: true,
        },
      });
    }

    if (!qrSession.qr_image) {
      const filename = `${class_id}/${qrSession.token}.png`;
      const objectKey = appConfig().storageUrl.classAttendance + '/' + filename;
      const qrCodeBuffer = await QRCode.toBuffer(
        JSON.stringify({ class_id, token: qrSession.token }),
        {
          type: 'png',
          margin: 1,
          errorCorrectionLevel: 'M',
        },
      );
      await NajimStorage.put(objectKey, qrCodeBuffer, {
        contentType: 'image/png',
      });
      qrSession = await this.prisma.qRAttendanceSession.update({
        where: { id: qrSession.id },
        data: { qr_image: objectKey },
        select: {
          id: true,
          class_id: true,
          token: true,
          qr_image: true,
        },
      });
    }

    return {
      id: qrSession.id,
      class_id: qrSession.class_id,
      qr_image: qrSession.qr_image
        ? NajimStorage.url(qrSession.qr_image)
        : null,
      token: qrSession.token,
    };
  }

  async getAllAttendance(user_id: string, query: AttendanceQueryDto) {
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }
    const {
      search,
      page: queryPage = 1,
      limit: queryLimit = 10,
      status,
      date,
      class_id,
      course_id,
    } = query;

    const page = Math.max(1, Math.trunc(Number(queryPage) || 1));
    const limit = Math.max(1, Math.trunc(Number(queryLimit) || 10));
    const start_date = date ? new Date(date) : null;
    if (start_date && Number.isNaN(start_date.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    start_date?.setHours(0, 0, 0, 0);
    const end_date = date ? new Date(date) : null;
    end_date?.setHours(23, 59, 59, 999);
    const searchValue = search || null;
    const statusValue = status || null;
    const classId = class_id || null;
    const courseId = course_id || null;

    const [attendanceResult] = await this.prisma.$queryRaw<
      {
        requester_type: string | null;
        total: number;
        data: {
          id: string | null;
          student: { id: string; name: string | null };
          created_at: Date | null;
          status: string;
          attendance_by: string | null;
          class_id: string | null;
        }[];
      }[]
    >`
        WITH requester AS (
          SELECT "type"
          FROM "users"
          WHERE "id" = ${user_id}
        ),
        eligible_students AS (
          SELECT DISTINCT u."id", u."name", e."course_id"
          FROM "enrollments" e
          JOIN "users" u ON u."id" = e."user_id"
          JOIN "courses" c ON c."id" = e."course_id"
          WHERE e."status" = 'ACTIVE'
            AND (${courseId}::text IS NULL OR c."id" = ${courseId})
            AND (
              (SELECT "type" FROM requester) <> ${Role.TEACHER}
              OR (
                c."instructor_id" = ${user_id}
                AND c."status" IN ('ACTIVE', 'COMPLETED', 'UPCOMING')
              )
            )
            AND (
              ${classId}::text IS NULL
              OR EXISTS (
                SELECT 1
                FROM "course_modules" cm
                JOIN "module_classes" mc ON mc."module_id" = cm."id"
                WHERE cm."course_id" = c."id"
                  AND mc."id" = ${classId}
              )
            )
            AND (
              ${searchValue}::text IS NULL
              OR u."name" ILIKE '%' || ${searchValue} || '%'
              OR u."email" ILIKE '%' || ${searchValue} || '%'
              OR u."phone_number" ILIKE '%' || ${searchValue} || '%'
            )
        ),
        classes_for_date AS (
          SELECT
            mc."id",
            mc."class_title",
            mc."class_name",
            mc."class_at",
            cm."course_id"
          FROM "module_classes" mc
          JOIN "course_modules" cm ON cm."id" = mc."module_id"
          JOIN "courses" c ON c."id" = cm."course_id"
          WHERE mc."class_at" IS NOT NULL
            AND (
              (
                ${start_date}::timestamp IS NULL
                AND mc."class_at" <= CURRENT_TIMESTAMP
              )
              OR (
                ${start_date}::timestamp IS NOT NULL
                AND ${start_date}::timestamp <= CURRENT_DATE
                AND mc."class_at" BETWEEN ${start_date} AND ${end_date}
              )
            )
            AND (${classId}::text IS NULL OR mc."id" = ${classId})
            AND (${courseId}::text IS NULL OR c."id" = ${courseId})
            AND (
              (SELECT "type" FROM requester) <> ${Role.TEACHER}
              OR (
                c."instructor_id" = ${user_id}
                AND c."status" IN ('ACTIVE', 'COMPLETED', 'UPCOMING')
              )
            )
        ),
        rows AS (
          SELECT
            a."id",
            es."id" AS student_id,
            es."name" AS student_name,
            a."created_at",
            COALESCE(a."status"::text, 'ABSENT') AS status,
            a."attendance_by",
            cfd."id" AS class_id,
            cfd."class_title",
            cfd."class_name",
            cfd."class_at"
          FROM classes_for_date cfd
          JOIN eligible_students es ON es."course_id" = cfd."course_id"
          LEFT JOIN "attendances" a
            ON a."class_id" = cfd."id"
           AND a."student_id" = es."id"
        ),
        filtered_rows AS (
          SELECT *
          FROM rows
          WHERE ${statusValue}::text IS NULL OR status = ${statusValue}::text
        ),
        total_rows AS (
          SELECT COUNT(*)::int AS total
          FROM filtered_rows
        ),
        paginated_rows AS (
          SELECT *
          FROM filtered_rows
          ORDER BY "class_at" ASC NULLS LAST, "student_name" ASC NULLS LAST
          LIMIT ${limit}
          OFFSET ${(page - 1) * limit}
        )
        SELECT
          (SELECT "type" FROM requester) AS requester_type,
          (SELECT total FROM total_rows) AS total,
          COALESCE(
            json_agg(
              json_build_object(
                'id', "id",
                'student', json_build_object('id', "student_id", 'name', "student_name"),
                'created_at', "created_at",
                'status', "status",
                'attendance_by', "attendance_by",
                'class_id', "class_id"
              )
            ) FILTER (WHERE "student_id" IS NOT NULL),
            '[]'::json
          ) AS data
        FROM paginated_rows
      `;

    if (!attendanceResult?.requester_type) {
      throw new NotFoundException('User not found');
    }
    if (attendanceResult.requester_type === Role.STUDENT) {
      throw new ForbiddenException('Forbidden');
    }

    return {
      success: true,
      message: 'Attendance fetched successfully',
      data: Array.isArray(attendanceResult.data) ? attendanceResult.data : [],
      meta_data: {
        page,
        limit,
        total: attendanceResult.total,
        search,
        status,
        date,
        class_id,
        course_id,
      },
    };
  }

  async markManualAttendance(body: UpdateAttendanceDto, user_id: string) {
    const { class_id, student_id, status, attended_at } = body;

    if (!class_id) {
      throw new BadRequestException('Class ID is required');
    }

    if (!student_id) {
      throw new BadRequestException('Student ID is required');
    }

    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const classData = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
    });

    if (!classData) {
      throw new NotFoundException('Class not found');
    }

    const student = await this.prisma.user.findUnique({
      where: { id: student_id },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    await this.prisma.attendance.upsert({
      where: {
        class_id_student_id: {
          class_id,
          student_id,
        },
      },
      update: {
        status,
        attended_at: status === AttendanceStatus.PRESENT ? attended_at : null,
        attendance_by: 'MANUAL',
        updated_at: new Date(),
      },
      create: {
        class_id,
        student_id,
        status,
        attended_at: status === AttendanceStatus.PRESENT ? attended_at : null,
        attendance_by: 'MANUAL',
      },
    });

    return {
      message: 'Attendance marked successfully',
      success: true,
    };
  }

  async createCourse(user_id: string, createCourseDto: CreateCourseDto) {
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const { instructor_id, ...courseData } = createCourseDto;

    if (instructor_id) {
      const instructor = await this.prisma.user.findFirst({
        where: {
          id: instructor_id,
          type: Role.TEACHER,
        },
      });

      if (!instructor) {
        throw new NotFoundException('Instructor not found');
      }
    }
    await this.prisma.course.create({
      data: {
        ...courseData,
        fee_pence: courseData?.fee_pence ? courseData?.fee_pence * 100 : 0,
        creator: {
          connect: { id: user_id },
        },
        ...(instructor_id && {
          instructor: {
            connect: { id: instructor_id },
          },
        }),
      },
    });

    return {
      message: 'Course created successfully',
      success: true,
    };
  }

  async getAllCourses(user_id: string, query: GetAllCourseQueryDto) {
    const {
      status,
      search,
      limit = 10,
      page = 1,
      user_id: query_user_id,
    } = query;
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const queryUser = query_user_id
      ? await this.prisma.user.findUnique({
          where: { id: query_user_id },
        })
      : null;

    if (query_user_id && !queryUser) {
      throw new NotFoundException('User not found');
    }

    const where: Prisma.CourseWhereInput = {
      status,
      instructor_id: user.type === Role.TEACHER ? user_id : undefined,
      ...(query_user_id &&
        queryUser?.type === Role.STUDENT && {
          enrollments: {
            some: {
              user: {
                type: Role.STUDENT,
                id: query_user_id,
              },
            },
          },
        }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { course_overview: { contains: search, mode: 'insensitive' } },
          { instructor: { name: { contains: search, mode: 'insensitive' } } },
          { instructor: { email: { contains: search, mode: 'insensitive' } } },
          {
            instructor: {
              phone_number: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      }),
    };

    const selectFields: Prisma.CourseSelect = {
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
    };

    if (query_user_id && queryUser?.type === Role.STUDENT) {
      selectFields.enrollments = {
        where: {
          user_id: query_user_id,
        },
        select: {
          status: true,
        },
      };
    }

    const courses = await this.prisma.course.findMany({
      where,
      select: selectFields,
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
        if (query_user_id && queryUser?.type === Role.STUDENT) {
          const enrollment = (course as any).enrollments?.[0];
          return {
            id: course.id,
            title: course.title,
            fee: course.fee_pence > 0 ? course.fee_pence / 100 : 0,
            duration: course.duration,
            start_date: course.start_date,
            status: course.status,
            enrollment_status: enrollment ? enrollment.status : null,
          };
        }

        const total_enrollments = course._count.enrollments;
        delete course._count;
        return {
          ...course,
          fee: course.fee_pence > 0 ? course.fee_pence / 100 : 0,
          total_enrollments,
        };
      }),
      meta_data: {
        page,
        limit,
        total: total_courses,
        search,
        status,
      },
    };
  }

  async getCoursesByUserId(user_id: string, admin_id: string) {
    if (!admin_id) throw new UnauthorizedException('Please login first!!');

    const user = await this.prisma.user.findUnique({
      where: {
        id: user_id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const where: Prisma.CourseWhereInput = {};

    if (user.type == Role.STUDENT) {
      where.enrollments = {
        some: { user_id: user_id, status: 'ACTIVE', step: 'COMPLETED' },
      };
    }
    if (user.type == Role.TEACHER) {
      where.instructor_id = user_id;
    }

    const courses = await this.prisma.course.findMany({
      where: {
        instructor_id: user_id,
      },
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
    });

    return {
      message: 'Courses fetched successfully',
      success: true,
      data: courses.map((course) => {
        const total_enrollments = course._count.enrollments;
        const course_progress = Math.max(
          0,
          Math.min(
            100,
            course?.duration
              ? ((Date.now() - new Date(course.start_date).getTime()) /
                  (Number(course.duration) * 86400000)) *
                  100
              : 0,
          ),
        );

        delete course._count;
        return {
          ...course,
          fee: course.fee_pence > 0 ? course.fee_pence / 100 : 0,
          total_enrollments,
          course_progress,
        };
      }),
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

    const course_progress = Math.max(
      0,
      Math.min(
        100,
        course?.duration
          ? ((Date.now() - new Date(course.start_date).getTime()) /
              (Number(course.duration) * 86400000)) *
              100
          : 0,
      ),
    );
    return {
      message: 'Course fetched successfully',
      success: true,
      data: {
        ...course,
        fee: course.fee_pence > 0 ? course.fee_pence / 100 : 0,
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

    const instructorId =
      typeof updateCourseDto.instructor_id === 'string'
        ? updateCourseDto.instructor_id.trim()
        : undefined;

    if (instructorId) {
      const instructor = await this.prisma.user.findFirst({
        where: {
          id: instructorId,
          type: Role.TEACHER,
        },
      });

      if (!instructor) {
        throw new NotFoundException('Instructor not found');
      }
    }

    const data: Prisma.CourseUpdateInput = {
      title: updateCourseDto.title ?? course.title,
      seat_capacity: updateCourseDto.seat_capacity ?? course.seat_capacity,
      fee_pence:
        updateCourseDto.fee_pence !== undefined
          ? Number(updateCourseDto.fee_pence) * 100
          : course.fee_pence,
      duration: updateCourseDto.duration ?? course.duration,
      class_time: updateCourseDto.class_time ?? course.class_time,
      start_date: updateCourseDto.start_date ?? course.start_date,
      course_overview:
        updateCourseDto.course_overview ?? course.course_overview,
      installment_process:
        updateCourseDto.installment_process ?? course.installment_process,
      rules_regulations:
        updateCourseDto.rules_regulations ?? course.rules_regulations,
      contract: updateCourseDto.contract ?? course.contract,
      status: updateCourseDto.status ?? course.status,
    };

    if (instructorId !== undefined) {
      data.instructor = {
        connect: {
          id: instructorId,
        },
      };
    }

    await this.prisma.course.update({
      where: { id: id },
      data,
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

  async deleteEnrollment(user_id: string, enrollment_id: string) {
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }
    const admin = await this.prisma.user.findUnique({
      where: { id: user_id },
    });
    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollment_id },
      include: {
        attachments: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Retrieve all assignment submissions of this student in this course
    const submissions = await this.prisma.assignmentSubmission.findMany({
      where: {
        student_id: enrollment.user_id,
        assignment: {
          class: {
            module: {
              course_id: enrollment.course_id,
            },
          },
        },
      },
      include: {
        attachments: true,
      },
    });

    // Collect all physical files to delete
    const filesToDelete: string[] = [];

    // Enrollment attachments (Rules & Contract PDFs)
    if (enrollment.attachments) {
      for (const attachment of enrollment.attachments) {
        if (attachment.file_path) {
          filesToDelete.push(attachment.file_path);
        }
      }
    }

    // Assignment submission attachments
    for (const submission of submissions) {
      if (submission.attachments) {
        for (const attachment of submission.attachments) {
          if (attachment.file_path) {
            filesToDelete.push(attachment.file_path);
          }
        }
      }
    }

    // Delete files from storage
    for (const filePath of filesToDelete) {
      try {
        await NajimStorage.delete(filePath);
      } catch (err) {
        this.logger.warn(
          `Failed to delete physical file: ${filePath}. Error: ${err.message}`,
        );
      }
    }

    // Delete DB records in a transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete Attendances for this student in classes of this course
      await tx.attendance.deleteMany({
        where: {
          student_id: enrollment.user_id,
          class: {
            module: {
              course_id: enrollment.course_id,
            },
          },
        },
      });

      // 2. Delete Assignment Submissions (cascades to grades & DB attachments)
      await tx.assignmentSubmission.deleteMany({
        where: {
          id: {
            in: submissions.map((s) => s.id),
          },
        },
      });

      // 3. Delete Enrollment attachments (Prisma cascade onDelete is configured, but explicit is safer)
      await tx.attachment.deleteMany({
        where: {
          enrollment_id: enrollment.id,
        },
      });

      // 4. Delete the Enrollment itself
      await tx.enrollment.delete({
        where: { id: enrollment.id },
      });

      // 5. Delete digital signatures (if they exist)
      if (enrollment.rules_regulations_signature_id) {
        await tx.digitalSignature.delete({
          where: { id: enrollment.rules_regulations_signature_id },
        });
      }
      if (enrollment.digital_contract_signature_id) {
        await tx.digitalSignature.delete({
          where: { id: enrollment.digital_contract_signature_id },
        });
      }

      // 6. Delete Order (cascades to transactions, installment plans/installments)
      if (enrollment.order_id) {
        await tx.order.delete({
          where: { id: enrollment.order_id },
        });
      }
    });

    return {
      success: true,
      message: 'Enrollment and all related records deleted successfully',
    };
  }

  async getAllEnrolledUserOfCourse(
    course_id: string,
    query: GetAllEnrolledUserQueryDto,
    user_id: string,
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

    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.EnrollmentWhereInput = {
      course_id: course_id,
      status: EnrollmentStatus.ACTIVE,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        progress_percent: true,
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    });

    const total = await this.prisma.enrollment.count({
      where: whereClause,
    });

    const totalAssignments = await this.prisma.assignment.count({
      where: {
        class: {
          module: {
            course_id: course_id,
          },
        },
      },
    });

    const totalClasses = await this.prisma.moduleClass.count({
      where: {
        module: {
          course_id: course_id,
        },
      },
    });

    const data = await Promise.all(
      enrollments.map(async (enrollment) => {
        const studentId = enrollment.user.id;
        const submittedAssignments =
          await this.prisma.assignmentSubmission.count({
            where: {
              student_id: studentId,
              assignment: {
                class: {
                  module: {
                    course_id: course_id,
                  },
                },
              },
              status: {
                in: [
                  AssignmentSubmissionStatus.SUBMITTED,
                  AssignmentSubmissionStatus.GRADED,
                ],
              },
            },
          });

        const attendedClasses = await this.prisma.attendance.count({
          where: {
            student_id: studentId,
            status: {
              in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE],
            },
            class: {
              module: {
                course_id: course_id,
              },
            },
          },
        });

        const attendance_percentage =
          totalClasses > 0
            ? Math.round((attendedClasses / totalClasses) * 100)
            : 0;

        return {
          id: enrollment.user.id,
          name: enrollment.user.name || enrollment.name,
          username: enrollment.user.username,
          student_id: enrollment.user.id,
          avatar_url: enrollment.user.avatar
            ? NajimStorage.url(enrollment.user.avatar)
            : null,
          attendance_percentage,
          assignments_completed: submittedAssignments,
          total_assignments: totalAssignments,
        };
      }),
    );

    return {
      success: true,
      message: 'Enrolled users fetched successfully',
      data,
      meta_data: {
        page,
        limit,
        total,
        search,
      },
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
      throw new ConflictException(
        `Module with title "${createModuleDto.module_title}" already exists in this course`,
      );
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
        },
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

    const course = await this.prisma.course.findUnique({
      where: { id: course_id },
    });
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
            class_at: true,
            duration: true,
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
      .sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      )[0];

    return {
      message: 'Modules fetched successfully',
      success: true,
      data: modules.map((moduleItem) => ({
        ...moduleItem,
        classes: moduleItem.classes.map((classItem) => {
          let status = 'PENDING';
          const startTime = classItem.start_at
            ? new Date(classItem.start_at)
            : classItem.class_at
              ? new Date(classItem.class_at)
              : null;
          const endTime = classItem.end_at
            ? new Date(classItem.end_at)
            : startTime && classItem.duration
              ? new Date(startTime.getTime() + classItem.duration * 60000)
              : startTime;

          if (endTime && endTime < now) {
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
      },
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
      throw new ConflictException(
        `Module with title "${updateModuleDto.module_title}" already exists in this course`,
      );

    const updatedModule = await this.prisma.courseModule.update({
      where: { id: module_id },
      data: {
        module_title: updateModuleDto.module_title ?? courseModule.module_title,
        module_name: updateModuleDto.module_name ?? courseModule.module_name,
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
  async addClass(
    user_id: string,
    module_id: string,
    createClassDto: CreateClassDto,
  ) {
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
      },
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
        class_at: true,
        start_at: true,
        end_at: true,
        module_id: true,
        duration: true,
      },
    });

    if (!classes || classes.length === 0) {
      return { message: 'No classes found', success: false };
    }

    const now = new Date();

    const nextClass = classes
      .filter((c) => new Date(c.class_at) > now)
      .sort(
        (a, b) =>
          new Date(a.class_at).getTime() - new Date(b.class_at).getTime(),
      )[0];

    return {
      message: 'Classes fetched successfully',
      success: true,
      data: classes.map((classItem) => {
        let status = 'PENDING';
        const startTime = classItem.start_at
          ? new Date(classItem.start_at)
          : classItem.class_at
            ? new Date(classItem.class_at)
            : null;
        const endTime = classItem.end_at
          ? new Date(classItem.end_at)
          : startTime && classItem.duration
            ? new Date(startTime.getTime() + classItem.duration * 60000)
            : startTime;

        if (endTime && endTime < now) {
          status = 'COMPLETED';
        } else if (nextClass && classItem.id === nextClass.id) {
          status = 'NEXT';
        }

        return {
          ...classItem,
          status,
        };
      }),
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
        class_at: true,
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
      select: { id: true, class_at: true },
    });

    const now = new Date();
    const nextClass = classesInModule
      .filter((c) => c.class_at && new Date(c.class_at) > now)
      .sort(
        (a, b) =>
          new Date(a.class_at).getTime() - new Date(b.class_at).getTime(),
      )[0];

    let status = 'PENDING';
    const startTime = classData.start_at
      ? new Date(classData.start_at)
      : classData.class_at
        ? new Date(classData.class_at)
        : null;
    const endTime = classData.end_at
      ? new Date(classData.end_at)
      : startTime && classData.duration
        ? new Date(startTime.getTime() + classData.duration * 60000)
        : startTime;

    if (endTime && endTime < now) {
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

  async updateClass(
    user_id: string,
    class_id: string,
    updateClassDto: UpdateClassDto,
  ) {
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
      newClassDate.setHours(
        existingClass.class_at.getHours(),
        existingClass.class_at.getMinutes(),
        0,
        0,
      );
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

  async startOrEndClass(
    user_id: string,
    class_id: string,
    status: 'START' | 'END',
  ) {
    if (!user_id) throw new UnauthorizedException('Unauthorized');

    const existingClass = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
    });

    if (!existingClass) {
      throw new NotFoundException('Class not found');
    }

    if (status === 'START') {
      if (existingClass.start_at) {
        throw new InternalServerErrorException('Class already started');
      }
      const updatedClass = await this.prisma.moduleClass.update({
        where: { id: class_id },
        data: {
          start_at: new Date(),
        },
      });
    } else if (status === 'END') {
      if (!existingClass.start_at) {
        throw new InternalServerErrorException('Class not started');
      }
      const qrSessions = await this.prisma.qRAttendanceSession.findMany({
        where: {
          class_id,
          qr_image: { not: null },
        },
        select: {
          qr_image: true,
        },
      });
      const updatedClass = await this.prisma.moduleClass.update({
        where: { id: class_id },
        data: {
          end_at: new Date(),
        },
      });
      await Promise.all(
        qrSessions.map((session) => NajimStorage.delete(session.qr_image!)),
      );
      await this.prisma.qRAttendanceSession.updateMany({
        where: { class_id },
        data: {
          is_active: false,
          qr_image: null,
        },
      });
    } else {
      throw new InternalServerErrorException('Failed to update class');
    }

    return {
      message: `Class ${status.toLowerCase()}ed successfully`,
      success: true,
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
        const filename = NajimStorage.generateFileName(file.originalname);
        const objectKey = `${appConfig().storageUrl.assignment}/${filename}`;

        await NajimStorage.put(objectKey, file.buffer);

        attachmentsData.push({
          file_name: filename,
          file_path: objectKey,
          mime_type: file.mimetype,
          size_bytes: file.size,
          type: AttachmentType.FILE,
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
        due_days: due_days > 0 ? due_days : null,
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
        assignment_id,
      },
    });

    return {
      message: 'Assignment retrieved successfully',
      success: true,
      data: {
        id: assignment?.id,
        title: assignment?.title,
        description: assignment?.description,
        attachments: assignment?.attachments?.map((attachment) => {
          return {
            file_name: attachment.file_name,
            file_path: attachment.file_path
              ? NajimStorage.url(attachment.file_path)
              : null,
            mime_type: attachment.mime_type,
          };
        }),
        submission_date: assignment?.submission_date,
        total_marks: assignment?.total_marks,
        class_id: assignment?.class?.id,
        instructor: {
          id: assignment?.class?.module?.course?.instructor?.id,
          name: assignment?.class?.module?.course?.instructor?.name,
        },
        submissions: assignment?._count?.submissions,
        grades: assignment?._count?.grades,
        average_score: average_score?._avg?.grade_number ?? 0,
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
        const filename = NajimStorage.generateFileName(file.originalname);
        const objectKey = `${appConfig().storageUrl.assignment}/${filename}`;
        await NajimStorage.put(objectKey, file.buffer);

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
        description: updateAssignmentDto.description || assignment.description,
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

  async getAllAssignmentsSubmissions(
    user_id: string,
    assignment_id: string,
    query: GetAllAssignmentQueryDto,
  ) {
    if (!user_id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignment_id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const { status, search, page = 1, limit = 10 } = query;

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
      ];

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
              file_path: attachment.file_path
                ? NajimStorage.url(attachment.file_path)
                : null,
              mime_type: attachment.mime_type,
            };
          }),

          student: {
            ...submission.student,
            avatar: submission.student?.avatar
              ? NajimStorage.url(submission.student?.avatar)
              : null,
          },
          grade,
        };
      }),
      meta_data: {
        total,
        page,
        limit,
        search,
        status,
      },
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
      throw new UnprocessableEntityException(
        'Grade number exceeds total marks of the assignment',
      );
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

    // Update submission status
    await this.prisma.assignmentSubmission.update({
      where: {
        id: submission_id,
      },
      data: {
        status: 'GRADED',
      },
    });

    // Create or update grade
    await this.prisma.assignmentGrade.upsert({
      where: {
        submission_id: submission_id,
      },
      update: {
        feedback: gradeAssignmentDto.feedback,
        grade: gradeAssignmentDto.grade ?? gradeLetter,
        grade_number: gradeAssignmentDto.grade_number,
        graded_by: 'TEACHER',
        creator: {
          connect: {
            id: user_id,
          },
        },
      },
      create: {
        feedback: gradeAssignmentDto.feedback,
        grade: gradeAssignmentDto.grade ?? gradeLetter,
        grade_number: gradeAssignmentDto.grade_number,
        graded_by: 'TEACHER',
        assignment: {
          connect: {
            id: submission.assignment_id,
          },
        },
        submission: {
          connect: {
            id: submission_id,
          },
        },
        creator: {
          connect: {
            id: user_id,
          },
        },
      },
    });

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
    if (!files || files.length === 0)
      throw new UnprocessableEntityException('No files uploaded');

    const existingClass = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
    });

    if (!existingClass) throw new NotFoundException('Class not found');

    const uploadPromises = files.map(async (file) => {
      try {
        const filename = NajimStorage.generateFileName(file.originalname);
        const objectKey = `${appConfig().storageUrl.class_assets}/${filename}`;

        await NajimStorage.put(objectKey, file.buffer);

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
      throw new InternalServerErrorException(
        'Failed to upload any class assets',
      );
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
    };
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
        videos: assets
          .filter((a) => a.type === 'VIDEO')
          .map((a) => {
            return {
              id: a.id,
              type: a.type,
              file_path: NajimStorage.url(a.file_path),
              file_name: a.file_name,
              mime_type: a.mime_type,
            };
          }),
        files: assets
          .filter((a) => a.type !== 'VIDEO')
          .map((a) => {
            return {
              id: a.id,
              type: a.type,
              file_path: NajimStorage.url(a.file_path),
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

    await NajimStorage.delete(asset.file_path);

    await this.prisma.attachment.delete({
      where: { id: asset_id },
    });

    return {
      message: 'Asset deleted successfully',
      success: true,
    };
  }
}
