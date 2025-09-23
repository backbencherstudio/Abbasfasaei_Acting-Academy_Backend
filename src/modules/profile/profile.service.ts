import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

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
  const paidPaymentCount = await this.prisma.paymentHistory.count({
    where: {
      user_id: userId,
      payment_status: 'PAID',
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
      // subscriptionPayment: await this.getSubscriptionPayment(userId),
      // contractDocuments: await this.getContractDocuments(userId),
      // feedbackCertificates: await this.getFeedbackCertificates(userId),
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
        about: true,
        country: true,
        city: true,
        address: true,
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
      about: user.about,
      address: {
        country: user.country,
        city: user.city,
        address: user.address,
      },
    };
  }

  async updatePersonalInfo(userId: string, updateData: any) {
    const { fullName, phone, dateOfBirth, experienceLevel, about, address } =
      updateData;

    // Split full name if provided
    let firstName, lastName;
    if (fullName) {
      const nameParts = fullName.split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName && {
          name: fullName,
          first_name: firstName,
          last_name: lastName,
        }),
        ...(phone && { phone_number: phone }),
        ...(dateOfBirth && { date_of_birth: new Date(dateOfBirth) }),
        ...(experienceLevel && { experience_level: experienceLevel }),
        ...(about && { about }),
        ...(address && {
          country: address.country,
          city: address.city,
          address: address.address,
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        date_of_birth: true,
        experience_level: true,
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
      },
    };
  }

  async changePassword(
    userId: string,
    passwordData: { currentPassword: string; newPassword: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    if (user.password) {
      const isCurrentPasswordValid = await bcrypt.compare(
        passwordData.currentPassword,
        user.password,
      );

      if (!isCurrentPasswordValid) {
        throw new ForbiddenException('Current password is incorrect');
      }
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async disableAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 0, // Disabled status
        deleted_at: new Date(),
      },
    });

    return { message: 'Account disabled successfully' };
  }

  async deleteAccount(userId: string) {
    // Check if user has active enrollments or payments
    const activeEnrollments = await this.prisma.enrollment.count({
      where: {
        user_id: userId,
        status: 'ACTIVE',
      },
    });

    if (activeEnrollments > 0) {
      throw new ConflictException(
        'Cannot delete account with active enrollments',
      );
    }

    // Soft delete the user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 0,
        deleted_at: new Date(),
        email: `deleted_${Date.now()}@deleted.com`, // Avoid unique constraint issues
        username: `deleted_${Date.now()}`,
      },
    });

    return { message: 'Account deleted successfully' };
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

    return { message: 'Logged out successfully' };
  }

  // Active User Only Methods
  // async getSubscriptionPayment(userId: string) {
  //   const payments = await this.prisma.paymentHistory.findMany({
  //     where: { user_id: userId },
  //     include: {
  //       userPayment: {
  //         include: {
  //           enrollment: {
  //             include: {
  //               course: true,
  //             },
  //           },
  //         },
  //       },
  //     },
  //     orderBy: { payment_date: 'desc' },
  //   });

  //   const enrollments = await this.prisma.enrollment.findMany({
  //     where: { user_id: userId },
  //     include: {
  //       course: true,
  //       payment: true,
  //     },
  //   });

  //   return {
  //     paymentHistory: payments.map((payment) => ({
  //       id: payment.id,
  //       amount: payment.amount,
  //       currency: payment.currency,
  //       paymentDate: payment.payment_date,
  //       status: payment.payment_status,
  //       type: payment.payment_type,
  //       course: payment.userPayment?.enrollment?.course?.title,
  //     })),
  //     currentSubscriptions: enrollments.map((enrollment) => ({
  //       course: enrollment.course?.title,
  //       status: enrollment.status,
  //       paymentStatus: enrollment.payment_status,
  //       startDate: enrollment.created_at,
  //     })),
  //   };
  // }

  // async getContractDocuments(userId: string) {
  //   const enrollments = await this.prisma.enrollment.findMany({
  //     where: { user_id: userId },
  //     include: {
  //       course: true,
  //       digital_contract_signing: {
  //         include: {
  //           digitalSignature: true,
  //         },
  //       },
  //       rules_regulations_signing: {
  //         include: {
  //           digitalSignature: true,
  //         },
  //       },
  //       contract_docs: true,
  //     },
  //   });

  //   return enrollments.map((enrollment) => ({
  //     course: enrollment.course?.title,
  //     contractDocs: enrollment.contract_docs,
  //     digitalContract: enrollment.digital_contract_signing,
  //     rulesRegulations: enrollment.rules_regulations_signing,
  //   }));
  // }

  // async getFeedbackCertificates(userId: string) {
  //   const assignments = await this.prisma.assignmentGrade.findMany({
  //     where: { studentId: userId },
  //     include: {
  //       assignment: {
  //         include: {
  //           moduleClass: {
  //             include: {
  //               module: {
  //                 include: {
  //                   course: true,
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });

  //   const enrollments = await this.prisma.enrollment.findMany({
  //     where: { user_id: userId, status: 'ACTIVE' },
  //     include: {
  //       course: true,
  //     },
  //   });

  //   return {
  //     feedback: assignments.map((assignment) => ({
  //       course: assignment.assignment.moduleClass.module.course.title,
  //       assignment: assignment.assignment.title,
  //       grade: assignment.grade,
  //       feedback: assignment.feedback,
  //       gradedAt: assignment.gradedAt,
  //     })),
  //     certificates: enrollments.map((enrollment) => ({
  //       course: enrollment.course.title,
  //       completionStatus: enrollment.status,
  //       certificateUrl: null, // You might want to add certificate URLs to your schema
  //     })),
  //   };
  // }
}
