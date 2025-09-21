import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnrollDto } from './dto/enroll.dto';
import { ExperienceLevel } from '@prisma/client';

@Injectable()
export class EnrollmentService {
  constructor(private prisma: PrismaService) {}

  async getAllCourses() {
    try {
      const courses = await this.prisma.course.findMany({
        orderBy: { created_at: 'desc' },
        select: { id: true, title: true, course_overview: true },
      });
      return { success: true, data: courses };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching courses');
    }
  }

  async enrollUser(userId: string, courseId: string, dto: EnrollDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const course = await this.prisma.course.findUnique({
        where: {
          id: courseId,
        },
      });

      if (!course) {
        return { success: false, message: 'Course not found' };
      }

      const existingEnrollment = await this.prisma.enrollment.findFirst({
        where: { user_id: user.id, courseId: course.id },
      });

      if (existingEnrollment) {
        return {
          success: false,
          message: 'User already enrolled in this course',
        };
      }

      // Create enrollment (no nested ActingGoals to avoid unique(userId) conflicts)
      const enrollment = await this.prisma.enrollment.create({
        data: {
          user_id: user.id,
          courseId: course.id,
          full_name: dto.full_name,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
          date_of_birth: new Date(dto.date_of_birth),
          experience_level: dto.experience_level as any as ExperienceLevel,
        },
      });

      // Upsert ActingGoals separately to respect unique(userId)
      let actingGoalsIdValue: string | undefined;
      try {
        if (dto.acting_goals) {
          const existingGoals = await this.prisma.actingGoals.findUnique({
            where: { userId: user.id },
            select: { id: true },
          });

          if (existingGoals) {
            const updatedGoals = await this.prisma.actingGoals.update({
              where: { userId: user.id },
              data: {
                acting_goals: dto.acting_goals,
                enrollmentId: enrollment.id,
              },
              select: {
                id: true,
                userId: true,
                enrollmentId: true,
                acting_goals: true,
              },
            });
            actingGoalsIdValue = updatedGoals.id;
          } else {
            const createdGoals = await this.prisma.actingGoals.create({
              data: {
                acting_goals: dto.acting_goals,
                userId: user.id,
                enrollmentId: enrollment.id,
              },
              select: {
                id: true,
                userId: true,
                enrollmentId: true,
                acting_goals: true,
              },
            });
            actingGoalsIdValue = createdGoals.id;
          }

          // Optionally store actingGoalsId on enrollment for quick reference
          if (actingGoalsIdValue) {
            await this.prisma.enrollment.update({
              where: { id: enrollment.id },
              data: { actingGoalsId: actingGoalsIdValue },
            });
          }
        }
      } catch (e) {
        // Non-fatal for enrollment flow; log for diagnostics
        console.error('ActingGoals upsert failed:', e);
      }

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
      }

      // Re-fetch the enrollment to reflect any updates (e.g., actingGoalsId)
      const enrichedEnrollment = await this.prisma.enrollment.findUnique({
        where: { id: enrollment.id },
      });

      return { success: true, enrollment: enrichedEnrollment ?? enrollment };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error enrolling user');
    }
  }

  async rulesAndRegulationsSigning(
    userId: string,
    enrollmentId: string,
    agreed: boolean,
    signature_full_name: string,
    signature: string,
    signature_date: string,
  ) {
    try {
      let enrollment = await this.prisma.enrollment.findFirst({
        where: { id: enrollmentId, user_id: userId },
        orderBy: { created_at: 'desc' },
      });

      // console.log('enrollment', enrollment);

      if (!enrollment) {
        // Fallback: If a courseId was provided by mistake, try finding by (courseId, user)
        enrollment = await this.prisma.enrollment.findFirst({
          where: { courseId: enrollmentId, user_id: userId },
          orderBy: { created_at: 'desc' },
        });
      }

      if (!enrollment) {
        return { success: false, message: 'Enrollment not found' };
      }

      const existingRulesTerms =
        await this.prisma.rulesAndRegulationsSigning.findUnique({
          where: { enrollmentId: enrollment.id },
        });

      if (existingRulesTerms) {
        await this.prisma.rulesAndRegulationsSigning.update({
          where: { enrollmentId: enrollment.id },
          data: { accepted: agreed },
        });
      } else {
        await this.prisma.rulesAndRegulationsSigning.create({
          data: {
            enrollmentId: enrollment.id,
            accepted: agreed,
          },
        });
      }

      if (!agreed) {
        return {
          success: false,
          message: 'Rules and regulations unchanged',
        };
      }

      if (agreed) {
        const parsedDate = new Date(signature_date);
        if (isNaN(parsedDate.valueOf())) {
          throw new BadRequestException('Invalid signature date');
        }
        if (!signature_full_name || !signature) {
          throw new BadRequestException('Missing signature name or signature');
        }
        await this.prisma.digitalSignature.upsert({
          where: { enrollmentId: enrollment.id },
          update: {
            full_name: signature_full_name,
            signature: signature,
            signed_at: parsedDate,
          },
          create: {
            enrollmentId: enrollment.id,
            full_name: signature_full_name,
            signature: signature,
            signed_at: parsedDate,
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

  async digitalContractSigning(
    userId: string,
    enrollmentId: string,
    accepted: boolean,
    signature_full_name: string,
    signature: string,
    signature_date: string,
  ) {
    try {
      let enrollment = await this.prisma.enrollment.findFirst({
        where: { id: enrollmentId, user_id: userId },
        orderBy: { created_at: 'desc' },
      });

      if (!enrollment) {
        enrollment = await this.prisma.enrollment.findFirst({
          where: { courseId: enrollmentId, user_id: userId },
          orderBy: { created_at: 'desc' },
        });
      }

      if (!enrollment) {
        return { success: false, message: 'Enrollment not found' };
      }

      console.log(enrollment);

      const existingContractTerms =
        await this.prisma.digitalContractSigning.findUnique({
          where: { enrollmentId: enrollment.id },
        });

      if (existingContractTerms) {
        await this.prisma.digitalContractSigning.update({
          where: { enrollmentId: enrollment.id },
          data: { agreed: accepted },
        });
      } else {
        await this.prisma.digitalContractSigning.create({
          data: {
            enrollmentId: enrollment.id,
            agreed: accepted,
          },
        });
      }

      if (accepted) {
        const parsedDate = new Date(signature_date);
        if (isNaN(parsedDate.valueOf())) {
          throw new BadRequestException('Invalid signature date');
        }
        if (!signature_full_name || !signature) {
          throw new BadRequestException('Missing signature name or signature');
        }
        await this.prisma.digitalSignature.upsert({
          where: { enrollmentId: enrollment.id },
          update: {
            full_name: signature_full_name,
            signature: signature,
            signed_at: parsedDate,
          },
          create: {
            enrollmentId: enrollment.id,
            full_name: signature_full_name,
            signature: signature,
            signed_at: parsedDate,
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

  async myCourses(userId: string) {
    try {
      if (!userId) {
        return { success: false, message: 'User ID is required' };
      }

      const enrollments = await this.prisma.enrollment.findMany({
        where: { user_id: userId },
        include: {
          course: true,
          actingGoals: true,
          digital_contract_signing: true,
          rules_regulations_signing: true,
        },
      });

      return { success: true, enrollments };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching enrolled courses');
    }
  }
}
