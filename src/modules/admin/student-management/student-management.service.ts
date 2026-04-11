import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';
import {
  EnrollmentStatus,
  EnrollmentStep,
  ExperienceLevel,
  PaymentGateway,
  Prisma,
} from '@prisma/client';
import { CombinedEnrollmentDto } from './dto/combined-enrollment.dto';

@Injectable()
export class StudentManagementService {
  constructor(private prisma: PrismaService) {}

  private getFileUrl(filename: string): string {
    if (!filename) return null;
    if (filename.startsWith('http')) return filename; // Legacy support
    return SazedStorage.url(appConfig().storageUrl.attachment + `/${filename}`);
  }

  private formatEnrollment(enrollment: any) {
    if (!enrollment) return enrollment;
    if (enrollment.enrolled_documents) {
      const docs = enrollment.enrolled_documents;
      if (typeof docs === 'object') {
        const formattedDocs = { ...docs };
        if (formattedDocs.rules_signing) {
          formattedDocs.rules_signing = this.getFileUrl(
            formattedDocs.rules_signing,
          );
        }
        if (formattedDocs.contract_signing) {
          formattedDocs.contract_signing = this.getFileUrl(
            formattedDocs.contract_signing,
          );
        }
        enrollment.enrolled_documents = formattedDocs;
      }
    }
    return enrollment;
  }

  async manualEnrollment(
    userId: string,
    dto: CombinedEnrollmentDto,
    tx: any = this.prisma,
  ) {
    if (!userId) {
      return {
        success: false,
        message: 'user not found',
      };
    }

    const user = await tx.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (!user) {
      return {
        success: false,
        message: 'Not Registered User',
      };
    }

    let courseId: string | undefined = dto.courseId;
    let course;

    if (courseId) {
      course = await tx.course.findUnique({
        where: { id: courseId },
        select: { id: true, title: true },
      });
      courseId = course?.id;
    }

    if (!course) {
      return { success: false, message: 'Course not found' };
    }

    // Check if the user is already enrolled
    const existingEnrollment = await tx.enrollment.findFirst({
      where: { email: dto.email, courseId: courseId },
    });

    if (existingEnrollment) {
      return {
        success: false,
        message: 'User is already enrolled',
      };
    }

    // Create a new enrollment (without nested ActingGoals to avoid relation violations)
    const createdEnrollment = await tx.enrollment.create({
      data: {
        user_id: user.id,
        courseId: courseId,
        full_name: dto.full_name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        date_of_birth: dto.date_of_birth ? new Date(dto.date_of_birth) : null,
        experience_level: dto.experience_level,
      },
      select: { id: true },
    });

    // Upsert ActingGoals and link to the newly created enrollment
    const existingGoals = await tx.actingGoals.findUnique({
      where: { userId: user.id },
      select: { id: true, enrollmentId: true },
    });

    if (existingGoals) {
      await tx.actingGoals.update({
        where: { id: existingGoals.id },
        data: {
          acting_goals: dto.acting_goals,
          enrollment: { connect: { id: createdEnrollment.id } },
        },
      });
    } else {
      await tx.actingGoals.create({
        data: {
          acting_goals: dto.acting_goals,
          user: { connect: { id: user.id } },
          enrollment: { connect: { id: createdEnrollment.id } },
        },
      });
    }

    // Re-fetch enriched enrollment payload
    const enrollment = await tx.enrollment.findUnique({
      where: { id: createdEnrollment.id },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        address: true,
        date_of_birth: true,
        experience_level: true,
        status: true,
        created_at: true,
        updated_at: true,
        user: { select: { id: true, email: true, role_users: true } },
        IsPaymentCompleted: true,
        actingGoals: {
          select: {
            id: true,
            acting_goals: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            course_overview: true,
          },
        },
        enrolled_documents: true,
      },
    });

    // Ensure platform role: STUDENT (only if user has no role yet)
    try {
      const existingRoleLink = await this.prisma.roleUser.findFirst({
        where: { user_id: user.id },
      });

      if (!existingRoleLink) {
        let studentRole = await this.prisma.role.findFirst({
          where: { name: 'STUDENT' },
          select: { id: true },
        });
        if (!studentRole) {
          studentRole = await this.prisma.role.create({
            data: { name: 'STUDENT', title: 'Student' },
            select: { id: true },
          });
        }
        await this.prisma.roleUser.create({
          data: { role_id: studentRole.id, user_id: user.id },
        });
      }
    } catch (e) {
      console.error('Auto-assign STUDENT role failed:', e);
      // Non-fatal for enrollment creation
    }

    return {
      success: true,
      data: this.formatEnrollment(enrollment),
    };
  }

  async combinedEnrollment(
    userId: string,
    dto: CombinedEnrollmentDto,
    files: {
      rules_signing?: Express.Multer.File[];
      contract_signing?: Express.Multer.File[];
    },
  ) {
    // 1. Validate file presence (mandatory)
    if (!files?.rules_signing || files.rules_signing.length === 0) {
      return { success: false, message: 'rules_signing file is required' };
    }
    if (!files?.contract_signing || files.contract_signing.length === 0) {
      return { success: false, message: 'contract_signing file is required' };
    }

    let uploadedUrls: any = {};
    if (files) {
      const uploadFile = async (file: Express.Multer.File) => {
        const filename = `${StringHelper.randomString(10)}_${file.originalname}`;
        await SazedStorage.put(
          appConfig().storageUrl.attachment + `/${filename}`,
          file.buffer,
        );
        return filename;
      };

      if (files.rules_signing && files.rules_signing.length > 0) {
        uploadedUrls.rules_signing = await uploadFile(files.rules_signing[0]);
      }

      if (files.contract_signing && files.contract_signing.length > 0) {
        uploadedUrls.contract_signing = await uploadFile(
          files.contract_signing[0],
        );
      }
    }

    // 2. Wrap database operations in a transaction
    const enrollmentResult = await this.prisma.$transaction(async (tx) => {
      const enrollmentResponse = await this.manualEnrollment(userId, dto, tx);
      if (!enrollmentResponse.success) {
        throw new Error(enrollmentResponse.message || 'Enrollment failed');
      }

      const enrollmentId = enrollmentResponse.data.id;

      // Handle Payment
      if (dto.transaction_id || dto.amount) {
        const paymentResponse = await this.manualEnrollmentPayment(
          enrollmentId,
          dto,
          tx,
        );
        if (!paymentResponse.success) {
          throw new Error(paymentResponse.message || 'Payment failed');
        }
      }

      // Save File URLs to database
      if (Object.keys(uploadedUrls).length > 0) {
        await tx.enrollment.update({
          where: { id: enrollmentId },
          data: { enrolled_documents: uploadedUrls },
        });
      }

      return enrollmentId;
    });

    // Return current enriched data
    return this.getEnrollmentPreviewContractDoc(enrollmentResult);
  }

  async manualEnrollmentPayment(
    enrollmentId: string,
    dto: CombinedEnrollmentDto,
    tx: any = this.prisma,
  ) {
    if (!enrollmentId) {
      return {
        success: false,
        message: 'enrollment not found',
      };
    }

    const enrollment = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        user: { select: { id: true, email: true } },
        course: { select: { id: true, title: true, fee: true } },
      },
    });

    if (!enrollment) {
      return {
        success: false,
        message: 'Enrollment not found',
      };
    }

    const existingPayment = await tx.payment.findFirst({
      where: {
        user_id: enrollment.user.id,
        course_id: enrollment.course.id,
      },
    });

    let paymentId = existingPayment?.id;
    if (!paymentId) {
      const payment = await tx.payment.create({
        data: {
          order_number: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          user_id: enrollment.user.id,
          total_amount: dto.amount || enrollment.course.fee,
          currency: dto.currency || 'usd',
          status:
            dto.payment_status === 'PAID' || dto.payment_status === 'SUCCESS'
              ? 'COMPLETED'
              : 'PENDING',
          item_type: 'COURSE_ENROLLMENT',
          payment_type: (dto.payment_type as any) || 'ONE_TIME',
          course_id: enrollment.course.id,
        },
      });
      paymentId = payment.id;
    }

    const transaction = await tx.transaction.create({
      data: {
        transaction_ref: dto.transaction_id || `MANUAL-${Date.now()}`,
        paymentId: paymentId,
        user_id: enrollment.user.id,
        amount: dto.amount || 0,
        currency: dto.currency || 'USD',
        status:
          dto.payment_status === 'PAID' || dto.payment_status === 'SUCCESS'
            ? 'SUCCESS'
            : 'PENDING',
        gateway: PaymentGateway.STRIPE_MANUAL_ENTRY,
        payment_method: dto.payment_method || 'card',
        payment_date: dto.payment_date ? new Date(dto.payment_date) : undefined,
        metadata: {
          payment_type: dto.payment_type || 'ONE_TIME',
          account_holder: dto.account_holder,
          card_number: dto.card_number,
          card_expiry: dto.card_expiry,
          invoice_sent: dto.invoice_sent,
          description: existingPayment
            ? 'Manual enrollment payment updated'
            : 'Manual enrollment payment created',
        },
      },
    });

    // Update the enrollment payment completion if successful
    if (transaction.status === 'SUCCESS') {
      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          IsPaymentCompleted: true,
          status: EnrollmentStatus.ACTIVE,
          step: EnrollmentStep.COMPLETED,
        },
      });
      await this.prisma.user.update({
        where: {
          id: enrollment.user.id,
        },
        data: {
          name: enrollment.user.first_name + ' ' + enrollment.user.last_name,
        },
      });
    }

    return {
      success: true,
      data: transaction,
      paymentHistory: [transaction],
    };
  }

  async manualEnrollmentContractDocs(
    enrollmentId: string,
    files: {
      rules_signing?: Express.Multer.File[];
      contract_signing?: Express.Multer.File[];
    },
    tx: any = this.prisma,
  ) {
    if (!enrollmentId) {
      return { success: false, message: 'enrollment not found' };
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      return {
        success: false,
        message: 'Enrollment not found',
      };
    }

    const uploadedUrls: any = (enrollment.enrolled_documents as any) || {};
    let hasNewFiles = false;

    const uploadFile = async (file: Express.Multer.File) => {
      const filename = `${StringHelper.randomString(10)}_${file.originalname}`;
      await SazedStorage.put(
        appConfig().storageUrl.attachment + `/${filename}`,
        file.buffer,
      );
      return filename;
    };

    if (files.rules_signing && files.rules_signing.length > 0) {
      uploadedUrls.rules_signing = await uploadFile(files.rules_signing[0]);
      hasNewFiles = true;
    }

    if (files.contract_signing && files.contract_signing.length > 0) {
      uploadedUrls.contract_signing = await uploadFile(
        files.contract_signing[0],
      );
      hasNewFiles = true;
    }

    if (hasNewFiles) {
      const updatedEnrollment = await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { enrolled_documents: uploadedUrls },
      });
      return {
        success: true,
        data: this.formatEnrollment(updatedEnrollment),
      };
    }

    return { success: false, message: 'No files provided' };
  }

  async getEnrollmentPreviewContractDoc(enrollmentId: string) {
    if (!enrollmentId) {
      return { success: false, message: 'enrollment not found' };
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        address: true,
        date_of_birth: true,
        experience_level: true,
        user: {
          select: {
            id: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            fee: true,
            duration: true,
          },
        },
        actingGoals: { select: { acting_goals: true } },
        IsPaymentCompleted: true,
        enrolled_documents: true,
      },
    });

    if (!enrollment) {
      return {
        success: false,
        message: 'Enrollment not found',
      };
    }

    return {
      success: true,
      data: this.formatEnrollment(enrollment),
    };
  }

  async getAllStudents(
    userId: string,
    query?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      experienceLevel?: string;
      paymentStatus?: string;
      courseId?: string;
    },
  ) {
    if (!userId) {
      return {
        success: false,
        message: 'user not found',
      };
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const requestedLimit = Number(query?.limit) || 10;
    const limit = Math.min(100, Math.max(1, requestedLimit));
    const skip = (page - 1) * limit;

    const search = (query?.search || '').trim();
    const status = (query?.status || '').trim().toUpperCase();
    const experienceLevel = (query?.experienceLevel || '').trim().toUpperCase();
    const paymentStatus = (query?.paymentStatus || '').trim().toLowerCase();
    const courseId = (query?.courseId || '').trim();

    const where: Prisma.EnrollmentWhereInput = {};

    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      const allowedStatuses = Object.values(EnrollmentStatus);
      if (!allowedStatuses.includes(status as EnrollmentStatus)) {
        return {
          success: false,
          message: `Invalid status filter. Allowed values: ${allowedStatuses.join(', ')}`,
        };
      }
      where.status = status as EnrollmentStatus;
    }

    if (experienceLevel) {
      const allowedExperienceLevels = Object.values(ExperienceLevel);
      if (
        !allowedExperienceLevels.includes(experienceLevel as ExperienceLevel)
      ) {
        return {
          success: false,
          message: `Invalid experienceLevel filter. Allowed values: ${allowedExperienceLevels.join(', ')}`,
        };
      }
      where.experience_level = experienceLevel as ExperienceLevel;
    }

    if (paymentStatus) {
      if (['true', '1', 'paid', 'completed'].includes(paymentStatus)) {
        where.IsPaymentCompleted = true;
      } else if (['false', '0', 'unpaid', 'pending'].includes(paymentStatus)) {
        where.IsPaymentCompleted = false;
      } else {
        return {
          success: false,
          message:
            'Invalid paymentStatus filter. Allowed values: true, false, paid, unpaid, completed, pending',
        };
      }
    }

    if (courseId) {
      where.courseId = courseId;
    }

    const [total, students] = await this.prisma.$transaction([
      this.prisma.enrollment.count({ where }),
      this.prisma.enrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
          address: true,
          date_of_birth: true,
          experience_level: true,
          status: true,
          created_at: true,
          updated_at: true,
          user: { select: { id: true, email: true, avatar: true } },
          IsPaymentCompleted: true,
          course: {
            select: {
              id: true,
              title: true,
              course_overview: true,
            },
          },
          actingGoals: {
            select: {
              acting_goals: true,
            },
          },
        },
      }),
    ]);

    const paymentConditions = Array.from(
      new Set(
        students
          .map((s) => `${s.user.id}::${s.course?.id ?? ''}`)
          .filter(Boolean),
      ),
    ).map((key) => {
      const [userIdFromRow, courseIdFromRow] = key.split('::');
      return {
        user_id: userIdFromRow,
        course_id: courseIdFromRow || null,
      };
    });

    const payments = paymentConditions.length
      ? await this.prisma.payment.findMany({
          where: { OR: paymentConditions },
          select: {
            user_id: true,
            course_id: true,
            status: true,
            payment_type: true,
            updated_at: true,
          },
          orderBy: { updated_at: 'desc' },
        })
      : [];

    const latestPaymentByKey = new Map<string, (typeof payments)[number]>();
    for (const payment of payments) {
      const key = `${payment.user_id}::${payment.course_id ?? ''}`;
      if (!latestPaymentByKey.has(key)) {
        latestPaymentByKey.set(key, payment);
      }
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      success: true,
      data: students.map((s) => {
        const paymentKey = `${s.user.id}::${s.course?.id ?? ''}`;
        const payment = latestPaymentByKey.get(paymentKey);

        return this.formatEnrollment({
          ...s,
          avatar: s.user?.avatar ?? null,
          joined_at: s.created_at,
          payment_status: payment?.status ?? (s.IsPaymentCompleted ? 'COMPLETED' : 'PENDING'),
          payment_type: payment?.payment_type ?? null,
        });
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getStudentById(studentId: string) {
    if (!studentId) {
      return { success: false, message: 'Student ID is required' };
    }

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        address: true,
        date_of_birth: true,
        experience_level: true,
        avatar: true,
        ActingGoals: { select: { acting_goals: true } },
        transactions: {
          select: {
            id: true,
            payment_method: true,
            transaction_ref: true,
            amount: true,
            payment_date: true,
            status: true,
          },
        },
      },
    });

    if (!student) {
      return {
        success: false,
        message: 'Student not found',
      };
    }

    return {
      success: true,
      data: student,
    };
  }

  async updateEnrollmentInfo(enrollmentId: string, dto: any) {
    if (!enrollmentId) {
      return { success: false, message: 'enrollment not found' };
    }

    if (!dto || typeof dto !== 'object') {
      return {
        success: false,
        message: 'Request body is required',
      };
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      return { success: false, message: 'Enrollment not found' };
    }

    const data: any = {};

    if (dto.status !== undefined) {
      const nextStatus = String(dto.status).toUpperCase();
      const allowedStatuses = Object.values(EnrollmentStatus);
      if (!allowedStatuses.includes(nextStatus as EnrollmentStatus)) {
        return {
          success: false,
          message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
        };
      }
      data.status = nextStatus as EnrollmentStatus;
    }

    if (dto.payment_status !== undefined) {
      const paymentStatus = String(dto.payment_status).toUpperCase();
      data.IsPaymentCompleted =
        paymentStatus === 'PAID' || paymentStatus === 'SUCCESS';
    }

    if (Object.keys(data).length === 0) {
      return {
        success: false,
        message: 'Nothing to update. Provide status or payment_status',
      };
    }

    const updatedEnrollment = await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data,
    });

    return { success: true, data: updatedEnrollment };
  }

  async restrictStudentAccess(
    enrollmentId: string,
    updateData?: { restrict?: boolean },
  ) {
    if (!enrollmentId) {
      return { success: false, message: 'Enrollment ID is required' };
    }

    // Ensure the enrollment exists
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, status: true, user: { select: { email: true } } },
    });

    if (!enrollment) {
      return { success: false, message: 'Enrollment not found' };
    }

    const hasExplicitFlag = typeof updateData?.restrict === 'boolean';
    const nextStatus = hasExplicitFlag
      ? updateData!.restrict
        ? 'RESTRICTED'
        : 'ACTIVE'
      : enrollment.status === 'RESTRICTED'
        ? 'ACTIVE'
        : 'RESTRICTED';

    const updatedEnrollment = await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: nextStatus,
        updated_at: new Date(),
      },
      select: { id: true, status: true, user: { select: { email: true } } },
    });

    return {
      success: true,
      message:
        nextStatus === 'RESTRICTED'
          ? 'Enrollment access restricted'
          : 'Enrollment access restored',
      data: updatedEnrollment,
    };
  }
}
