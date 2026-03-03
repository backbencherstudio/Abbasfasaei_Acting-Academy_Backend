import { Injectable } from '@nestjs/common';
import { CreateStudentManagementDto } from './dto/create-student-management.dto';
import { UpdateStudentManagementDto } from './dto/update-student-management.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { id } from 'date-fns/locale';
import { StringHelper } from 'src/common/helper/string.helper';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class StudentManagementService {
  constructor(private prisma: PrismaService) {}

  async manualEnrollment(userId: string, dto: any) {
    if (!userId) {
      return {
        success: false,
        message: 'user not found',
      };
    }

    const user = await this.prisma.user.findUnique({
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
      course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, title: true },
      });
      courseId = course.id;
    }

    if (!course) {
      return { success: false, message: 'Course not found' };
    }

    // Check if the user is already enrolled
    const existingEnrollment = await this.prisma.enrollment.findFirst({
      where: { email: dto.email, courseId: courseId },
    });

    if (existingEnrollment) {
      return {
        success: false,
        message: 'User is already enrolled',
      };
    }

    // Create a new enrollment (without nested ActingGoals to avoid relation violations)
    const createdEnrollment = await this.prisma.enrollment.create({
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
    const existingGoals = await this.prisma.actingGoals.findUnique({
      where: { userId: user.id },
      select: { id: true, enrollmentId: true },
    });

    if (existingGoals) {
      await this.prisma.actingGoals.update({
        where: { id: existingGoals.id },
        data: {
          acting_goals: dto.acting_goals,
          enrollment: { connect: { id: createdEnrollment.id } },
        },
      });
    } else {
      await this.prisma.actingGoals.create({
        data: {
          acting_goals: dto.acting_goals,
          user: { connect: { id: user.id } },
          enrollment: { connect: { id: createdEnrollment.id } },
        },
      });
    }

    // Re-fetch enriched enrollment payload
    const enrollment = await this.prisma.enrollment.findUnique({
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
        contract_docs: true,
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
      data: enrollment,
    };
  }

  async manualEnrollmentPayment(enrollmentId: string, dto: any) {
    if (!enrollmentId) {
      return {
        success: false,
        message: 'enrollment not found',
      };
    }

    const enrollment = await this.prisma.enrollment.findUnique({
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

    console.log('enrollment in payment:', enrollment);

    const existingOrder = await this.prisma.order.findFirst({
      where: {
        user_id: enrollment.user.id,
        items: { some: { course_id: enrollment.course.id } },
      },
    });

    let orderId = existingOrder?.id;
    if (!orderId) {
      const order = await this.prisma.order.create({
        data: {
          order_number: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          user_id: enrollment.user.id,
          total_amount: dto.amount || enrollment.course.fee,
          currency: dto.currency || 'USD',
          status:
            dto.payment_status === 'PAID' || dto.payment_status === 'SUCCESS'
              ? 'COMPLETED'
              : 'PENDING',
          items: {
            create: {
              item_type: 'COURSE_ENROLLMENT',
              course_id: enrollment.course.id,
              unit_price: enrollment.course.fee || 0,
              quantity: 1,
              total_price: enrollment.course.fee || 0,
            },
          },
        },
      });
      orderId = order.id;
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        transaction_ref: dto.transaction_id || `MANUAL-${Date.now()}`,
        order_id: orderId,
        user_id: enrollment.user.id,
        amount: dto.amount || 0,
        currency: dto.currency || 'USD',
        status:
          dto.payment_status === 'PAID' || dto.payment_status === 'SUCCESS'
            ? 'SUCCESS'
            : 'PENDING',
        gateway: 'MANUAL_BANK_TRANSFER',
        payment_method: dto.payment_method,
        metadata: {
          payment_type: dto.payment_type,
          account_holder: dto.account_holder,
          card_number: dto.card_number,
          card_expiry: dto.card_expiry,
          invoice_sent: dto.invoice_sent,
          description: existingOrder
            ? 'Manual enrollment payment updated'
            : 'Manual enrollment payment created',
        },
      },
    });

    // Update the enrollment payment completion if successful
    if (transaction.status === 'SUCCESS') {
      await this.prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { IsPaymentCompleted: true },
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
    files: Express.Multer.File[],
    // mediaType: 'FILE' | 'IMAGE' | 'VIDEO',
  ) {
    let mediaUrls: string[] = [];

    if (!enrollmentId) {
      return { success: false, message: 'enrollment not found' };
    }

    const enrollment = await this.prisma.enrollment.findUnique({
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

      const updatedEnrollment = await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          contract_docs: mediaUrls,
        },
      });

      return { success: true, data: updatedEnrollment };
    }
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

        contract_docs: true,
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
      data: enrollment,
    };
  }

  async getAllStudents(userId: string) {
    if (!userId) {
      return {
        success: false,
        message: 'user not found',
      };
    }

    const students = await this.prisma.enrollment.findMany({
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
        user: { select: { id: true, email: true } },
        IsPaymentCompleted: true,
        actingGoalsId: true,
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
    });

    return {
      success: true,
      data: students,
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

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      return { success: false, message: 'Enrollment not found' };
    }

    const updatedEnrollment = await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: dto.status,
        IsPaymentCompleted:
          dto.payment_status === 'PAID' || dto.payment_status === 'SUCCESS',
      },
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
