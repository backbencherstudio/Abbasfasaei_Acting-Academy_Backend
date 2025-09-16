import { Injectable } from '@nestjs/common';
import { CreateStudentManagementDto } from './dto/create-student-management.dto';
import { UpdateStudentManagementDto } from './dto/update-student-management.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { id } from 'date-fns/locale';

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

    // Create a new payment
    const payment = await this.prisma.enrollmentPayment.create({
      data: {
        enrollmentId: enrollment.id,
        transaction_id: dto.transaction_id,
        payment_type: dto.payment_type,
        payment_status: dto.payment_status,
        payment_date: new Date(dto.payment_date),
        user: {
          connect: { id: enrollment.user.id },
        },
        course: {
          connect: { id: enrollment.course.id },
        },
        amount: enrollment.course.fee,
        currency: 'USD',
        payment_type: dto.payment_type,
        status: 'PENDING',
      },
    });

    return {
      success: true,
      data: payment,
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
