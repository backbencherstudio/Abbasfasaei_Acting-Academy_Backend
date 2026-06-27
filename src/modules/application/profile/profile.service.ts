import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import appConfig from 'src/config/app.config';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import { UserStatus } from 'src/common/constants/user-status.enum';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('document-queue') private readonly documentQueue: Queue,
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
    return NajimStorage.url(appConfig().storageUrl.media + '/' + filename);
  }

  async getPersonalInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        date_of_birth: true,
        experience: true,
        avatar: true,
        about: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      fullName: user.name || 'User',
      email: user.email,
      phone: user.phone_number,
      dateOfBirth: user.date_of_birth,
      experienceLevel: user.experience,
      avatar: user.avatar,
      actingGoals: user?.about || null,
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
      updateFields.name = fullName;
    }

    if (phone !== undefined) {
      updateFields.phone_number = phone || null; // খালি string হলে null
    }

    if (dateOfBirth !== undefined) {
      updateFields.date_of_birth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    if (experienceLevel !== undefined) {
      updateFields.experience = experienceLevel || null;
    }

    if (actingGoals !== undefined) {
      updateFields.about = actingGoals || '';
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
        experience: true,
        about: true,
      },
    });

    return {
      message: 'Personal information updated successfully',
      user: {
        fullName: user.name,
        email: user.email,
        phone: user.phone_number,
        dateOfBirth: user.date_of_birth,
        experienceLevel: user.experience,
        actingGoals: user.about || null,
      },
    };
  }

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
    await this.prisma.user.update({
      where: { id: userId },
      data: { last_active_at: new Date() },
    });
    const response = await this.revokeRefreshToken(userId);
    return { message: 'Logged out successfully', response };
  }

  // Active User Only Methods
  async getSubscriptionPayment(userId: string) {
    const payments = await this.prisma.paymentTransaction.findMany({
      where: { user_id: userId },
      include: {
        order: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { paid_at: 'desc' },
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
        paymentDate: payment.paid_at,
        status: payment.status,
        course: payment.order?.course?.title,
      })),
      currentSubscriptions: enrollments.map((enrollment) => ({
        course: enrollment.course?.title,
        status: enrollment.status,
        IsPaymentCompleted: enrollment.step === 'COMPLETED',
        startDate: enrollment.created_at,
      })),
    };
  }

  // Support (Contact form submission)
  async submitSupportRequest(
    user_id: string,
    body: {
      name?: string;
      email?: string;
      phone_number?: string;
      reason?: string;
      message: string;
    },
  ) {
    let user: any;
    if (user_id) {
      user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { name: true, email: true, phone_number: true },
      });
    }

    const supportTicket = await this.prisma.contact.create({
      data: {
        name: body.name || user?.name,
        email: body.email || user?.email,
        phone_number: body.phone_number || user?.phone_number,
        reason: body.reason || 'Other',
        message: body.message,
      },
    });

    return {
      success: true,
      message: 'Support request submitted successfully',
    };
  }

  // My Documents (Signed Contracts)
  async getSignedDocuments(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { user_id: userId },
      include: {
        course: true,
        digital_contract_signature: true,
        rules_regulations_signature: true,
        attachments: true,
      },
    });

    const data = await Promise.all(
      enrollments.map(async (enrollment) => {
        const documents = [];

        // Rules & Regulations
        const rulesSignature = enrollment.rules_regulations_signature;
        if (rulesSignature) {
          const rulesAttachment = enrollment.attachments?.find(
            (a) => a.type === 'RULES_REGULATIONS',
          );

          if (rulesAttachment) {
            documents.push({
              type: 'RULES_REGULATIONS',
              document_name: 'Rules & Regulations Agreement',
              status: 'READY',
              document_url: this.getFileUrl(
                rulesAttachment.file_path.split('/').pop(),
              ),
              signed_date: rulesSignature.signed_at || enrollment.updated_at,
            });
          } else {
            try {
              await this.documentQueue.add('generateDocument', {
                enrollmentId: enrollment.id,
                documentType: 'rules',
              });
              this.logger.log(
                `On-demand queued rules document generation for enrollment ${enrollment.id}`,
              );
            } catch (err) {
              this.logger.error(
                `Failed to queue rules document for enrollment ${enrollment.id}: ${err.message}`,
              );
            }

            documents.push({
              type: 'RULES_REGULATIONS',
              document_name: 'Rules & Regulations Agreement',
              status: 'GENERATING',
              document_url: null,
              signed_date: rulesSignature.signed_at || enrollment.updated_at,
            });
          }
        }

        // Digital Contract
        const contractSignature = enrollment.digital_contract_signature;
        if (contractSignature) {
          const contractAttachment = enrollment.attachments?.find(
            (a) => a.type === 'DIGITAL_CONTRACT',
          );

          if (contractAttachment) {
            documents.push({
              type: 'DIGITAL_CONTRACT',
              document_name: 'Digital Enrollment Contract',
              status: 'READY',
              document_url: this.getFileUrl(
                contractAttachment.file_path.split('/').pop(),
              ),
              signed_date: contractSignature.signed_at || enrollment.updated_at,
            });
          } else {
            try {
              await this.documentQueue.add('generateDocument', {
                enrollmentId: enrollment.id,
                documentType: 'contract',
              });
              this.logger.log(
                `On-demand queued contract document generation for enrollment ${enrollment.id}`,
              );
            } catch (err) {
              this.logger.error(
                `Failed to queue contract document for enrollment ${enrollment.id}: ${err.message}`,
              );
            }

            documents.push({
              type: 'DIGITAL_CONTRACT',
              document_name: 'Digital Enrollment Contract',
              status: 'GENERATING',
              document_url: null,
              signed_date: contractSignature.signed_at || enrollment.updated_at,
            });
          }
        }

        return {
          course_id: enrollment.course_id,
          course_name: enrollment.course?.title || 'Unknown Course',
          enrolled_date: enrollment.created_at,
          documents,
        };
      }),
    );

    return {
      success: true,
      message: 'Contract documents fetched successfully',
      data,
    };
  }
}
