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

    // Create a new payment
    const payment = await this.prisma.enrollmentPayment.create({
      data: {
        enrollment: { connect: { id: enrollment.id } },
        user: { connect: { id: enrollment.user.id } },
        transaction_id: dto.transaction_id,
        payment_date: new Date(dto.payment_date),
        amount: dto.amount,
      },
      select: {
        id: true,
        transaction_id: true,
        payment_date: true,
        user: { select: { id: true, email: true } },
        amount: true,
        currency: true,
        payment_status: true,
        enrollment: { select: { id: true, courseId: true } },
      },
    });

    return {
      success: true,
      data: payment,
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
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone_number: true,
            date_of_birth: true,
            experience_level: true,
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

  findOne(id: number) {
    return `This action returns a #${id} studentManagement`;
  }

  update(id: number, updateStudentManagementDto: UpdateStudentManagementDto) {
    return `This action updates a #${id} studentManagement`;
  }

  remove(id: number) {
    return `This action removes a #${id} studentManagement`;
  }
}
