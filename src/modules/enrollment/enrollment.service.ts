import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnrollDto } from './dto/enroll.dto';

@Injectable()
export class EnrollmentService {
  constructor(private prisma: PrismaService) {}

  async enrollUser(userId: string, dto: EnrollDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Create enrollment
      const enrollment = await this.prisma.enrollment.create({
        data: {
          user_id: user.id,
          // course_type:
          // dto.course_type as any as import('@prisma/client').CourseType,
          full_name: dto.full_name,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
          date_of_birth: new Date(dto.date_of_birth),
          experience_level:
            dto.experience_level as any as import('@prisma/client').ExperienceLevel,

          actingGoals: {
            create: {
              acting_goals: dto.acting_goals,
              userId: user.id,
            },
          },
        },
      });

      // Ensure platform role: STUDENT (only if user has no role yet)
      try {
        // Check if the user already has any platform role assigned
        const existingRoleLink = await this.prisma.roleUser.findFirst({
          where: { user_id: user.id },
        });

        if (!existingRoleLink) {
          // Find or create the STUDENT role
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
        // Don't fail the enrollment if role wiring has a transient issue; log for investigation
        console.error('Auto-assign STUDENT role failed:', e);
      }

      return { success: true, enrollmentId: enrollment.id };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error enrolling user');
    }
  }

  async acceptRulesAndRegulations(
    userId: string,
    agreed: boolean,
    signature_full_name: string,
    signature: string,
    signature_date: string,
  ) {
    try {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { user_id: userId },
      });

      if (!enrollment) {
        return { success: false, message: 'Enrollment not found' };
      }

      const existingTerms =
        await this.prisma.enrollmentTermsAndConditions.findUnique({
          where: { enrollmentId: enrollment.id },
        });

      if (existingTerms) {
        await this.prisma.enrollmentTermsAndConditions.update({
          where: { enrollmentId: enrollment.id },
          data: { accepted: agreed },
        });
      } else {
        await this.prisma.enrollmentTermsAndConditions.create({
          data: {
            enrollmentId: enrollment.id,
            accepted: agreed,
          },
        });
      }

      // add digital signature if agreed
      if (agreed) {
        await this.prisma.digitalSignature.create({
          data: {
            enrollmentId: enrollment.id,
            full_name: signature_full_name,
            signature: signature,
            signed_at: new Date(signature_date), // Convert ISO string to Date
          },
        });
      }

      return {
        success: true,
        enrollmentId: enrollment.id,
        message: 'Rules and regulations updated',
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error accepting rules and regulations',
      );
    }
  }

  async acceptContractTerms(userId: string, accepted: boolean) {
    try {
      // Find the existing enrollment for the user
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { user_id: userId },
      });

      if (!enrollment) {
        return { success: false, message: 'Enrollment not found' };
      }

      // Check if the contract terms have already been accepted for the given enrollment
      const existingContractTerms =
        await this.prisma.enrollmentContractTerms.findUnique({
          where: { enrollmentId: enrollment.id },
        });

      // If the user has already accepted the contract terms and clicks to toggle off, update the existing record
      if (existingContractTerms) {
        await this.prisma.enrollmentContractTerms.update({
          where: { enrollmentId: enrollment.id },
          data: { agreed: accepted },
        });
      } else {
        // If the contract terms haven't been accepted yet, create a new record
        await this.prisma.enrollmentContractTerms.create({
          data: {
            enrollmentId: enrollment.id,
            agreed: accepted,
          },
        });
      }

      return {
        success: true,
        enrollmentId: enrollment.id,
        message: 'Contract terms updated',
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error accepting contract terms');
    }
  }

  //   async processPayment(userId: string, amount: number, paymentMethod: string) {
  //     try {
  //       const enrollment = await this.prisma.enrollment.findFirst({
  //         where: { user_id: userId },
  //       });

  //       if (!enrollment) {
  //         return { success: false, message: 'Enrollment not found' };
  //       }

  //       // Process Payment
  //       await this.prisma.enrollmentPayment.create({
  //         data: {
  //           enrollmentId: enrollment.id,
  //           payment_type: 'MONTHLY', // Adjust as needed
  //           payment_status: 'COMPLETED', // Adjust as needed
  //           payment_method: paymentMethod,
  //         },
  //       });

  //       return { success: true };
  //     } catch (error) {
  //       console.error(error);
  //       throw new InternalServerErrorException('Error processing payment');
  //     }
  //   }
  // }
}
