import { Injectable } from '@nestjs/common';
import { CreateStudentManagementDto } from './dto/create-student-management.dto';
import { UpdateStudentManagementDto } from './dto/update-student-management.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { id } from 'date-fns/locale';
import { StringHelper } from 'src/common/helper/string.helper';
import { SazedStorage } from 'src/common/lib/disk/SazedStorage';
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

    const courseTitle = await this.prisma.course.findMany({
      select: { title: true, id: true },
    });
    console.log('course titles:', courseTitle, courseTitle[0]?.id);

    // Check if the user is already enrolled
    const existingEnrollment = await this.prisma.enrollment.findFirst({
      where: { email: dto.email },
    });

    if (existingEnrollment) {
      return {
        success: false,
        message: 'User is already enrolled',
      };
    }
    // Create a new enrollment
    const enrollment = await this.prisma.enrollment.create({
      data: {
        user_id: user.id,
        courseId: courseTitle[0]?.id,
        full_name: dto.full_name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        date_of_birth: dto.date_of_birth,
        experience_level: dto.experience_level,
        status: dto.status || 'PENDING',
        actingGoals: {
          create: {
            acting_goals: dto.acting_goals,
            user: {
              connect: { id: user.id },
            },
          },
        },
      },
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
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        payment: {
          select: {
            id: true,
            payment_type: true,
            payment_status: true,
          },
        },
        actingGoals: {
          select: {
            acting_goals: true,
            id: true,
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

    // If a payment already exists for this enrollment, update it; otherwise create a new one
    const existingPayment = await this.prisma.userPayment.findUnique({
      where: { enrollmentId: enrollment.id },
      select: { id: true },
    });

    const dataToPersist: any = {
      transaction_id: dto.transaction_id,
      amount: dto.amount,
      payment_date: dto.payment_date ? new Date(dto.payment_date) : undefined,
      payment_type: dto.payment_type,
      payment_status: dto.payment_status,
      currency: dto.currency,
      payment_method: dto.payment_method,
      account_holder: dto.account_holder,
      card_number: dto.card_number,
      card_expiry: dto.card_expiry,
      card_cvc: dto.card_cvc,
      invoice_sent: dto.invoice_sent,
    };

    // Clean undefined to avoid unintended nulling
    Object.keys(dataToPersist).forEach((k) =>
      dataToPersist[k] === undefined ? delete dataToPersist[k] : null,
    );

    let payment;
    if (existingPayment) {
      payment = await this.prisma.userPayment.update({
        where: { id: existingPayment.id },
        data: dataToPersist,
        select: {
          id: true,
          transaction_id: true,
          payment_date: true,
          amount: true,
          currency: true,
          payment_status: true,
          user: { select: { id: true, email: true } },
          enrollment: { select: { id: true, courseId: true } },
        },
      });
    } else {
      payment = await this.prisma.userPayment.create({
        data: {
          enrollment: { connect: { id: enrollment.id } },
          user: { connect: { id: enrollment.user.id } },
          ...dataToPersist,
        },
        select: {
          id: true,
          transaction_id: true,
          payment_date: true,
          amount: true,
          currency: true,
          payment_status: true,
          user: { select: { id: true, email: true } },
          enrollment: { select: { id: true, courseId: true } },
        },
      });
    }

    console.log('payment:', payment);

    const paymentHistory = await this.prisma.paymentHistory.create({
      data: {
        user_id: enrollment.user.id,
        userPaymentId: payment.id,
        amount: payment.amount,
        payment_date: payment.payment_date,
        transaction_id: payment.transaction_id,
        payment_status: payment.payment_status,
        description: existingPayment
          ? 'Manual enrollment payment updated'
          : 'Manual enrollment payment created',
      },
    });

    return {
      success: true,
      data: payment,
      paymentHistory: paymentHistory,
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
        payment: {
          select: {
            id: true,
            transaction_id: true,
            amount: true,
            payment_date: true,
            payment_status: true,
          },
        },

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
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        payment: {
          select: {
            id: true,
            payment_type: true,
            payment_status: true,
          },
        },
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
        payment_histories: {
          select: {
            id: true,
            userPayment: {
              select: {
                id: true,
                payment_type: true,
                transaction_id: true,
                amount: true,
                payment_date: true,
              },
            },
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
        role: dto.role,
        payment: {
          upsert: {
            where: { enrollmentId: enrollmentId },
            update: {
              payment_status: dto.payment_status,
              payment_type: dto.payment_type,
            },
            create: {
              user: { connect: { id: enrollment.user_id } },
              payment_status: dto.payment_status,
              payment_type: dto.payment_type,
            },
          },
        },
      },
    });

    return { success: true, data: updatedEnrollment };
  }
}
