import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRepository } from 'src/common/repository/user/user.repository';
import * as bcrypt from 'bcrypt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import appConfig from 'src/config/app.config';
import { SazedStorage } from 'src/common/lib/Disk/SazedStorage';
import { UserStatus } from 'src/common/constants/user-status.enum';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private async revokeRefreshToken(user_id: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);
      if (!storedToken) {
        return {
          success: false,
          message: 'Refresh token not found',
        };
      }

      await this.redis.del(`refresh_token:${user_id}`);

      return {
        success: true,
        message: 'Refresh token revoked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  private getFileUrl(filename: string): string {
    if (!filename) return null;
    if (filename.startsWith('http')) return filename; // Legacy support
    return SazedStorage.url(appConfig().storageUrl.attachment + '/' + filename);
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

  async getCompleteProfile(userId: string) {
    // Step 1: Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        experience_level: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Step 2: Count paid payments
    const paidPaymentCount = await this.prisma.transaction.count({
      where: {
        user_id: userId,
        status: 'SUCCESS',
      },
    });

    const hasPaid = paidPaymentCount > 0;
    const profileType = hasPaid ? 'active' : 'general';

    // Base profile response for all users
    const baseProfile = {
      profileType,
      personalInfo: await this.getPersonalInfo(userId),
      hasActiveSubscription: hasPaid,
    };

    // Add active user features only if they have paid
    if (hasPaid) {
      return {
        ...baseProfile,
        subscriptionPayment: await this.getSubscriptionPayment(userId),
        contractDocuments: await this.getContractDocuments(userId),
        feedbackCertificates: await this.getFeedbackCertificates(userId),
      };
    }

    // Return general profile for users without payments
    return baseProfile;
  }

  async getPersonalInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        date_of_birth: true,
        experience_level: true,
        avatar: true,
        ActingGoals: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      fullName: user.name || `${user.first_name} ${user.last_name}`.trim(),
      email: user.email,
      phone: user.phone_number,
      dateOfBirth: user.date_of_birth,
      experienceLevel: user.experience_level,
      avatar: user.avatar,
      actingGoals: user?.ActingGoals?.acting_goals || null,
    };
  }

  async updatePersonalInfo(userId: string, updateData: any) {
    const {
      fullName,
      phone,
      dateOfBirth,
      experienceLevel,
      actingGoals,
      address,
    } = updateData;

    // Dynamic data object তৈরি করুন
    const updateFields: any = {};

    // প্রত্যেক ফিল্ড চেক করে যোগ করুন
    if (fullName !== undefined) {
      const nameParts = fullName.split(' ');
      updateFields.name = fullName;
      updateFields.first_name = nameParts[0];
      updateFields.last_name = nameParts.slice(1).join(' ');
    }

    if (phone !== undefined) {
      updateFields.phone_number = phone || null; // খালি string হলে null
    }

    if (dateOfBirth !== undefined) {
      updateFields.date_of_birth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    if (experienceLevel !== undefined) {
      updateFields.experience_level = experienceLevel || null;
    }

    if (actingGoals !== undefined) {
      const goalsValue = actingGoals || '';
      updateFields.about = goalsValue;
      updateFields.ActingGoals = {
        upsert: {
          create: { acting_goals: goalsValue },
          update: { acting_goals: goalsValue },
        },
      };
    }

    if (address) {
      if (address.country !== undefined) {
        updateFields.country = address.country || null;
      }
      if (address.city !== undefined) {
        updateFields.city = address.city || null;
      }
      if (address.address !== undefined) {
        updateFields.address = address.address || null;
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateFields,
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        date_of_birth: true,
        experience_level: true,
        about: true,
        ActingGoals: true,
      },
    });

    return {
      message: 'Personal information updated successfully',
      user: {
        fullName: user.name,
        email: user.email,
        phone: user.phone_number,
        dateOfBirth: user.date_of_birth,
        experienceLevel: user.experience_level,
        actingGoals: user?.ActingGoals?.acting_goals || null,
      },
    };
  }

  // async changePassword(
  //   userId: string,
  //   passwordData: { currentPassword: string; newPassword: string },
  // ) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     select: { password: true },
  //   });

  //   if (!user) {
  //     throw new NotFoundException('User not found');
  //   }

  //   // Verify current password
  //   if (user.password) {
  //     const isCurrentPasswordValid = await bcrypt.compare(
  //       passwordData.currentPassword,
  //       user.password,
  //     );

  //     if (!isCurrentPasswordValid) {
  //       throw new ForbiddenException('Current password is incorrect');
  //     }
  //   }

  //   // Hash new password
  //   const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, 12);

  //   await this.prisma.user.update({
  //     where: { id: userId },
  //     data: { password: hashedNewPassword },
  //   });

  //   return { message: 'Password changed successfully' };
  // }

  async disableAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.DEACTIVATED,
        deleted_at: new Date(),
      },
    });

    const response = await this.revokeRefreshToken(userId);

    return { message: 'Account disabled successfully', response };
  }

  async activateAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        deleted_at: null,
      },
    });

    return { message: 'Account activated successfully' };
  }

  async deleteAccount(userId: string) {
    // Hard delete the user
    await this.prisma.user.delete({
      where: { id: userId },
    });

    const response = await this.revokeRefreshToken(userId);

    return { message: 'Account deleted successfully', response };
  }

  // async getNotificationSettings(userId: string) {
  //   const settings = await this.prisma.userSetting.findMany({
  //     where: {
  //       user_id: userId,
  //       setting: {
  //         category: 'notification',
  //       },
  //     },
  //     include: {
  //       setting: true,
  //     },
  //   });

  //   // Default notification settings if none exist
  //   if (settings.length === 0) {
  //     return {
  //       pushNotifications: true,
  //       emailNotifications: true,
  //       smsNotifications: false,
  //       courseUpdates: true,
  //       eventReminders: true,
  //     };
  //   }

  //   // Transform settings into a more usable format
  //   const notificationSettings = {};
  //   settings.forEach((setting) => {
  //     notificationSettings[setting.setting.key] = setting.value === 'true';
  //   });

  //   return notificationSettings;
  // }

  // async updateNotificationSettings(userId: string, settings: any) {
  //   const settingKeys = Object.keys(settings);

  //   for (const key of settingKeys) {
  //     const setting = await this.prisma.setting.findUnique({
  //       where: { key },
  //     });

  //     if (setting) {
  //       await this.prisma.userSetting.upsert({
  //         where: {
  //           user_id: userId,
  //           setting_id: setting.id,
  //         },
  //         update: {
  //           value: settings[key].toString(),
  //         },
  //         create: {
  //           user_id: userId,
  //           setting_id: setting.id,
  //           value: settings[key].toString(),
  //         },
  //       });
  //     }
  //   }

  //   return { message: 'Notification settings updated successfully' };
  // }

  // async submitSupportRequest(userId: string, supportData: any) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     select: { name: true, email: true },
  //   });

  //   // Create a support ticket (you might want to create a SupportTicket model)
  //   // For now, we'll use the Contact model
  //   const supportTicket = await this.prisma.contact.create({
  //     data: {
  //       first_name: user.name?.split(' ')[0] || 'User',
  //       last_name: user.name?.split(' ').slice(1).join(' ') || '',
  //       email: user.email,
  //       phone_number: supportData.phone,
  //       message: supportData.message,
  //     },
  //   });

  //   return {
  //     message: 'Support request submitted successfully',
  //     ticketId: supportTicket.id,
  //   };
  // }

  async logout(userId: string) {
    // In a real implementation, you might want to:
    // 1. Add the token to a blacklist
    // 2. Update user's last logout time
    // 3. Clear any session data

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });

    const response = await this.revokeRefreshToken(userId);

    return { message: 'Logged out successfully', response };
  }

  // Active User Only Methods
  async getSubscriptionPayment(userId: string) {
    const payments = await this.prisma.transaction.findMany({
      where: { user_id: userId },
      include: {
        payment: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { payment_date: 'desc' },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { user_id: userId },
      include: {
        course: {
          select: {
            title: true,
          },
        },
      },
    });

    return {
      paymentHistory: payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        paymentDate: payment.payment_date,
        status: payment.status,
        course: payment.payment?.course?.title,
      })),
      currentSubscriptions: enrollments.map((enrollment) => ({
        course: enrollment.course?.title,
        status: enrollment.status,
        IsPaymentCompleted: enrollment.IsPaymentCompleted,
        startDate: enrollment.created_at,
      })),
    };
  }

  async getContractDocuments(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { user_id: userId },
      include: {
        course: true,
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
    });

    return enrollments.map((enrollment) => {
      const formatted = this.formatEnrollment(enrollment);
      return {
        course: formatted.course?.title,
        enrolled_documents: formatted.enrolled_documents,
        digitalContract: formatted.digital_contract_signing,
        rulesRegulations: formatted.rules_regulations_signing,
      };
    });
  }

  async getFeedbackCertificates(userId: string) {
    const assignments = await this.prisma.assignmentGrade.findMany({
      where: { studentId: userId },
      include: {
        assignment: {
          include: {
            moduleClass: {
              include: {
                module: {
                  include: {
                    course: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { user_id: userId, status: 'ACTIVE' },
      include: {
        course: true,
      },
    });

    return {
      feedback: assignments.map((assignment) => ({
        course: assignment.assignment.moduleClass.module.course.title,
        assignment: assignment.assignment.title,
        grade: assignment.grade,
        feedback: assignment.feedback,
        gradedAt: assignment.gradedAt,
      })),
      certificates: enrollments.map((enrollment) => ({
        course: enrollment.course?.title,
        completionStatus: enrollment.status,
        certificateUrl: null, // You might want to add certificate URLs to your schema
      })),
    };
  }
}
