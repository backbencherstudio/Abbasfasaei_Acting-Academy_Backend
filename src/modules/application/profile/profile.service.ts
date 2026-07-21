import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import appConfig from 'src/config/app.config';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import { UserStatus } from 'src/common/constants/user-status.enum';
import { QueryPaymentHistoryDto } from './dto/query-profile.dto';

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

  async getNotificationSettings(userId: string) {
    const userSetting = await this.prisma.userSetting.findFirst({
      where: {
        user_id: userId,
        setting: {
          key: 'is_notification_enabled',
        },
      },
      include: {
        setting: true,
      },
    });

    const is_notification_enabled = userSetting
      ? userSetting.value === 'true' || userSetting.value === '1'
      : true;

    return {
      success: true,
      data: {
        is_notification_enabled,
      },
    };
  }

  async updateNotificationSettings(
    userId: string,
    settingsDto?: { is_notification_enabled?: boolean; [key: string]: any },
  ) {
    const key = 'is_notification_enabled';

    let setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      setting = await this.prisma.setting.create({
        data: {
          key,
          category: 'notification',
          label: 'Notification Enabled',
          default_value: 'true',
        },
      });
    }

    const existingUserSetting = await this.prisma.userSetting.findFirst({
      where: {
        user_id: userId,
        setting_id: setting.id,
      },
    });

    const currentState = existingUserSetting
      ? existingUserSetting.value === 'true' ||
        existingUserSetting.value === '1'
      : true;

    let isEnabled: boolean;
    if (settingsDto?.is_notification_enabled !== undefined) {
      isEnabled = Boolean(settingsDto.is_notification_enabled);
    } else if (settingsDto?.enabled !== undefined) {
      isEnabled = Boolean(settingsDto.enabled);
    } else {
      isEnabled = !currentState;
    }

    const stringValue = String(isEnabled);

    if (existingUserSetting) {
      await this.prisma.userSetting.update({
        where: { id: existingUserSetting.id },
        data: { value: stringValue },
      });
    } else {
      await this.prisma.userSetting.create({
        data: {
          user_id: userId,
          setting_id: setting.id,
          value: stringValue,
        },
      });
    }

    return {
      success: true,
      message: `Notification turned ${isEnabled ? 'on' : 'off'} successfully`,
      data: {
        is_notification_enabled: isEnabled,
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { last_active_at: new Date() },
    });
    const response = await this.revokeRefreshToken(userId);
    return { message: 'Logged out successfully', response };
  }

  async getPaymentHistory(userId: string, query: QueryPaymentHistoryDto) {
    const limit = query.limit ? Number(query.limit) : 10;
    const cursor = query.cursor;

    const where = { user_id: userId };

    const [total, payments] = await Promise.all([
      this.prisma.paymentTransaction.count({ where }),
      this.prisma.paymentTransaction.findMany({
        where,
        include: {
          order: {
            include: {
              course: {
                select: {
                  title: true,
                },
              },
              event: {
                select: {
                  name: true,
                },
              },
            },
          },
          installment: true,
        },
        orderBy: { created_at: 'desc' },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : undefined,
      }),
    ]);

    let nextCursor: string | null = null;
    if (payments.length > limit) {
      const nextItem = payments.pop();
      nextCursor = nextItem.id;
    }

    const data = payments.map((payment) => {
      let title = 'Payment';
      if (payment.order?.course?.title) {
        title = payment.order.course.title;
        if (
          payment.installment ||
          payment.order.payment_mode === 'INSTALLMENT'
        ) {
          title += ' - Monthly Payment';
        }
      } else if (payment.order?.event?.name) {
        title = payment.order.event.name;
        if (payment.order.item_type === 'EVENT_TICKET') {
          title += ' - Event Ticket';
        }
      } else if (payment.order?.notes) {
        title = payment.order.notes;
      }

      return {
        id: payment.id,
        title,
        transaction_id: payment.transaction_ref || payment.id,
        amount: payment.amount,
        currency: payment.currency,
        payment_date: payment.paid_at || payment.created_at,
        status: payment.status,
      };
    });

    return {
      success: true,
      data,
      meta_data: {
        total,
        limit,
        next_cursor: nextCursor,
        has_more: nextCursor !== null,
      },
    };
  }

  async getMyCourses(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { user_id: userId },
      include: {
        course: true,
        order: {
          include: {
            installment_plan: {
              include: {
                installments: {
                  orderBy: { installment_no: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const data = enrollments.map((enrollment) => {
      const isInstallment =
        enrollment.enrollment_type === 'INSTALLMENT' ||
        enrollment.order?.payment_mode === 'INSTALLMENT' ||
        !!enrollment.order?.installment_plan;

      const baseTitle = enrollment.course?.title || 'Course';
      const title = isInstallment
        ? `${baseTitle} - Monthly Payment`
        : baseTitle;

      if (isInstallment && enrollment.order?.installment_plan) {
        const plan = enrollment.order.installment_plan;
        const totalInstallments =
          plan.installment_count || plan.installments.length || 0;
        const paidInstallments = plan.installments.filter(
          (i) => i.status === 'PAID',
        ).length;
        const sampleAmount = plan.installments[0]?.amount
          ? Number(plan.installments[0].amount)
          : plan.total_amount
            ? Number(plan.total_amount) / (totalInstallments || 1)
            : 0;

        const currency = enrollment.order?.currency || 'USD';

        return {
          id: enrollment.id,
          enrollment_id: enrollment.id,
          course_id: enrollment.course_id,
          order_id: enrollment.order_id,
          title,
          is_installment: true,
          monthly_amount: sampleAmount,
          currency,
          total_installments: totalInstallments,
          paid_installments: paidInstallments,
          monthly_payment_text: `$${sampleAmount.toFixed(2)}/month • ${totalInstallments} months`,
          installment_progress_text: `${paidInstallments} of ${totalInstallments} paid`,
          progress_percentage:
            totalInstallments > 0
              ? Math.round((paidInstallments / totalInstallments) * 100)
              : 0,
          status: enrollment.status,
          created_at: enrollment.created_at,
        };
      }

      return {
        id: enrollment.id,
        enrollment_id: enrollment.id,
        course_id: enrollment.course_id,
        order_id: enrollment.order_id,
        title,
        is_installment: false,
        total_amount: enrollment.order?.total_amount
          ? Number(enrollment.order.total_amount)
          : enrollment.course?.fee_pence
            ? enrollment.course.fee_pence / 100
            : 0,
        currency: enrollment.order?.currency || 'USD',
        status: enrollment.status,
        created_at: enrollment.created_at,
      };
    });

    return {
      success: true,
      data,
    };
  }

  async getCourseDetails(userId: string, id: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        user_id: userId,
        OR: [{ id }, { course_id: id }, { order_id: id }],
      },
      include: {
        course: true,
        order: {
          include: {
            installment_plan: {
              include: {
                installments: {
                  orderBy: { installment_no: 'asc' },
                },
              },
            },
            transactions: {
              orderBy: { created_at: 'desc' },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrolled course not found');
    }

    const isInstallment =
      enrollment.enrollment_type === 'INSTALLMENT' ||
      enrollment.order?.payment_mode === 'INSTALLMENT' ||
      !!enrollment.order?.installment_plan;

    const baseTitle = enrollment.course?.title || 'Course';
    const title = isInstallment ? `${baseTitle} - Monthly Payment` : baseTitle;

    const currency = enrollment.order?.currency || 'USD';

    if (isInstallment && enrollment.order?.installment_plan) {
      const plan = enrollment.order.installment_plan;
      const totalInstallments =
        plan.installment_count || plan.installments.length || 0;
      const paidInstallments = plan.installments.filter(
        (i) => i.status === 'PAID',
      ).length;

      const items = plan.installments.map((inst) => ({
        id: inst.id,
        title: `Installment #${inst.installment_no}`,
        installment_no: inst.installment_no,
        status: inst.status,
        date: inst.paid_at || inst.due_date,
        amount: Number(inst.amount),
        currency,
      }));

      return {
        success: true,
        data: {
          id: enrollment.id,
          enrollment_id: enrollment.id,
          course_id: enrollment.course_id,
          order_id: enrollment.order_id,
          title,
          is_installment: true,
          total_installments: totalInstallments,
          paid_installments: paidInstallments,
          installment_progress_text: `${paidInstallments} of ${totalInstallments} paid`,
          status: enrollment.status,
          items,
        },
      };
    }

    // Full Payment / Non-installment
    const transactions = enrollment.order?.transactions || [];
    const items = transactions.map((tx) => ({
      id: tx.id,
      title: title,
      transaction_id: tx.transaction_ref || tx.id,
      status: tx.status,
      date: tx.paid_at || tx.created_at,
      amount: Number(tx.amount),
      currency: tx.currency || currency,
    }));

    return {
      success: true,
      data: {
        id: enrollment.id,
        enrollment_id: enrollment.id,
        course_id: enrollment.course_id,
        order_id: enrollment.order_id,
        title,
        is_installment: false,
        status: enrollment.status,
        items,
      },
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
