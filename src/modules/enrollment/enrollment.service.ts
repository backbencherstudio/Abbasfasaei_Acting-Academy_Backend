import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AcceptRulesOrContractDto,
  EnrollDto,
  PInfoDto,
} from './dto/enroll.dto';
import {
  EnrollmentStatus,
  EnrollmentStep,
  ExperienceLevel,
} from '@prisma/client';

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

  async getCurrentStep(userId: string, courseId: string) {
    try {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { user_id: userId, courseId: courseId },
        include: {
          actingGoals: true,
          digital_contract_signing: {
            include: {
              digitalSignature: true,
            },
          },
          rules_regulations_signing: {
            include: {
              digitalSignature: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      let data: any = {
        enrollment_id: enrollment.id,
      };

      switch (enrollment.step) {
        case EnrollmentStep.FORM_FILLING:
          data.step = enrollment.step;
          data.full_name = enrollment.full_name;
          data.email = enrollment.email;
          data.phone = enrollment.phone;
          data.address = enrollment.address;
          data.date_of_birth = enrollment.date_of_birth;
          data.experience_level = enrollment.experience_level;
          data.acting_goals = enrollment.actingGoals?.acting_goals;
          break;
        case EnrollmentStep.RULES_SIGNING:
          data.step = enrollment.step;
          data.accepted = enrollment.rules_regulations_signing.accepted;
          data.full_name =
            enrollment.rules_regulations_signing.digitalSignature.full_name;
          data.digital_signature =
            enrollment.rules_regulations_signing.digitalSignature.signature;
          data.digital_signature_date =
            enrollment.rules_regulations_signing.digitalSignature.signed_at;
          break;
        case EnrollmentStep.CONTRACT_SIGNING:
          data.step = enrollment.step;
          data.accepted = enrollment.digital_contract_signing.agreed;
          data.full_name =
            enrollment.digital_contract_signing.digitalSignature.full_name;
          data.digital_signature =
            enrollment.digital_contract_signing.digitalSignature.signature;
          data.digital_signature_date =
            enrollment.digital_contract_signing.digitalSignature.signed_at;
          break;
        case EnrollmentStep.COMPLETED:
          data.step = enrollment.step;
          break;
      }

      return { success: true, data };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching enrollment');
    }
  }

  async enrollUser(userId: string, courseId: string, dto: PInfoDto) {
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
        where: {
          user_id: user.id,
          courseId: course.id,
          step: EnrollmentStep.COMPLETED,
        },
      });

      if (existingEnrollment) {
        return {
          success: false,
          message: 'User already enrolled in this course',
        };
      }

      const existingEnrollmentFormFilling =
        await this.prisma.enrollment.findFirst({
          where: {
            user_id: user.id,
            courseId: course.id,
            step: EnrollmentStep.FORM_FILLING,
          },
        });

      if (existingEnrollmentFormFilling) {
        return {
          success: true,
          message: 'User already enrolled in this course',
          data: existingEnrollmentFormFilling,
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
          experience_level: dto.experience_level,
          step: EnrollmentStep.FORM_FILLING,
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

      return {
        success: true,
        message: 'User enrolled successfully',
        enrollment: enrichedEnrollment ?? enrollment,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error enrolling user');
    }
  }

  async acceptRules(
    userId: string,
    enrollmentId: string,
    dto: AcceptRulesOrContractDto,
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
        await this.prisma.enrollment.update({
          where: { id: enrollment.id },
          data: {
            step: EnrollmentStep.RULES_SIGNING,
            rules_regulations_signing: {
              update: {
                accepted: dto.accepted,
                digitalSignature: {
                  update: {
                    full_name: dto.full_name,
                    signature: dto.digital_signature,
                    signed_at: dto.digital_signature_date,
                  },
                },
              },
            },
          },
        });
      } else {
        // await this.prisma.rulesAndRegulationsSigning.create({
        //   data: {
        //     enrollmentId: enrollment.id,
        //     accepted: dto.accepted,
        //   },
        // });
        await this.prisma.enrollment.update({
          where: { id: enrollment.id },
          data: {
            step: EnrollmentStep.RULES_SIGNING,
            rules_regulations_signing: {
              create: {
                accepted: dto.accepted,
                digitalSignature: {
                  create: {
                    full_name: dto.full_name,
                    signed_at: dto.digital_signature_date,
                    signature: dto.digital_signature,
                  },
                },
              },
            },
          },
        });
      }

      if (!dto.accepted) {
        return {
          success: false,
          message: 'Rules and regulations unchanged',
        };
      }

      // if (dto.accepted) {
      //   const parsedDate = new Date(dto.digital_signature_date);
      //   if (isNaN(parsedDate.valueOf())) {
      //     throw new BadRequestException('Invalid signature date');
      //   }
      //   if (!dto.full_name || !dto.digital_signature) {
      //     throw new BadRequestException('Missing signature name or signature');
      //   }
      //   await this.prisma.digitalSignature.upsert({
      //     where: { enrollmentId: enrollment.id },
      //     update: {
      //       full_name: dto.full_name,
      //       signature: dto.digital_signature,
      //       signed_at: parsedDate,
      //     },
      //     create: {
      //       enrollmentId: enrollment.id,
      //       full_name: dto.full_name,
      //       signature: dto.digital_signature,
      //       signed_at: parsedDate,
      //     },
      //   });
      // }

      return {
        success: true,
        enrollmentId: enrollment.id,
        message: 'Rules and regulations signed successfully',
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error accepting rules and regulations',
      );
    }
  }

  async acceptContract(
    userId: string,
    enrollmentId: string,
    dto: AcceptRulesOrContractDto,
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
        await this.prisma.enrollment.update({
          where: { id: enrollment.id },
          data: {
            step: EnrollmentStep.CONTRACT_SIGNING,
            digital_contract_signing: {
              update: {
                agreed: dto.accepted,
                digitalSignature: {
                  update: {
                    full_name: dto.full_name,
                    signature: dto.digital_signature,
                    signed_at: dto.digital_signature_date,
                  },
                },
              },
            },
          },
        });
      } else {
        await this.prisma.enrollment.update({
          where: { id: enrollment.id },
          data: {
            step: EnrollmentStep.CONTRACT_SIGNING,
            digital_contract_signing: {
              create: {
                agreed: dto.accepted,
                digitalSignature: {
                  create: {
                    full_name: dto.full_name,
                    signed_at: dto.digital_signature_date,
                    signature: dto.digital_signature,
                  },
                },
              },
            },
          },
        });
      }

      // if (accepted) {
      //   const parsedDate = new Date(signature_date);
      //   if (isNaN(parsedDate.valueOf())) {
      //     throw new BadRequestException('Invalid signature date');
      //   }
      //   if (!signature_full_name || !signature) {
      //     throw new BadRequestException('Missing signature name or signature');
      //   }
      //   await this.prisma.digitalSignature.upsert({
      //     where: { enrollmentId: enrollment.id },
      //     update: {
      //       full_name: signature_full_name,
      //       signature: signature,
      //       signed_at: parsedDate,
      //     },
      //     create: {
      //       enrollmentId: enrollment.id,
      //       full_name: signature_full_name,
      //       signature: signature,
      //       signed_at: parsedDate,
      //     },
      //   });
      // }

      return {
        success: true,
        enrollmentId: enrollment.id,
        message: 'Contract signed successfully',
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error accepting contract terms');
    }
  }

  // Payment processing is centralized under payment module (StripeController/StripeService)

  async myCourses(userId: string) {
    try {
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          user_id: userId,
          IsPaymentCompleted: true,
          status: EnrollmentStatus.ACTIVE,
        },
        select: {
          id: true,
          courseId: true,
          course: {
            select: {
              id: true,
              title: true,
              course_overview: true,
              _count: {
                select: {
                  modules: true,
                },
              },
            },
          },
        },
      });

      const responseData = enrollments.map((enrollment) => {
        return {
          course_id: enrollment.course.id,
          course_title: enrollment.course.title,
          course_overview: enrollment.course.course_overview,
          course_modules: enrollment.course._count.modules,
        };
      });

      return { success: true, enrollments: responseData };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error fetching enrolled courses');
    }
  }
}
