import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsiteInfoService } from '../website-info/website-info.service';
import * as bcrypt from 'bcrypt';
import { UpdateUserSettingsDto } from './dto/update-profile.dto';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private websiteSettings: WebsiteInfoService,
  ) {}

  async allSettings() {
    const settings = await this.websiteSettings.findAll();
    return settings;
  }

  async allProfileSettings(userId: string) {
    const allProfileInfo = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        first_name: true,
        last_name: true,
        email: true,
        password: true,
      },
    });
    return allProfileInfo;
  }

  async profileUpdate(userId: string, dto: UpdateUserSettingsDto) {
    try {
      const {
        firstName,
        lastName,
        email,
        currentPassword,
        newPassword,
        confirmNewPassword,
      } = dto;

      const updateData: any = {};
      let userData: any = null; // Declare userData outside the block

      if (firstName) updateData.first_name = firstName;
      if (lastName) updateData.last_name = lastName;
      if (email) updateData.email = email;

      if (currentPassword || newPassword || confirmNewPassword) {
        if (!currentPassword || !newPassword || !confirmNewPassword) {
          throw new BadRequestException(
            'All password fields are required when updating password',
          );
        }

        if (newPassword !== confirmNewPassword) {
          throw new BadRequestException('New passwords do not match');
        }

        
        userData = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            password: true,
            first_name: true,
            last_name: true,
          },
        });

        if (!userData) {
          throw new BadRequestException('User not found');
        }

        const isCurrentPasswordValid = await bcrypt.compare(
          currentPassword,
          userData.password,
        );

        if (!isCurrentPasswordValid) {
          throw new BadRequestException('Current password is incorrect');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        updateData.password = hashedNewPassword;
      }

      
      if ((firstName || lastName) && !userData) {
        userData = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            first_name: true,
            last_name: true,
          },
        });
      }

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No data provided for update');
      }

      if (firstName || lastName) {
        const currentFirstName = firstName || userData?.first_name || '';
        const currentLastName = lastName || userData?.last_name || '';
        updateData.name = `${currentFirstName} ${currentLastName}`.trim();
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          name: true,
        },
      });

      return {
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error.code === 'P2002') {
        throw new BadRequestException('Email already exists');
      }
      return {
        success: false,
        message: error.message,
      };
    }
  }


  async getRolesAndPermission(userId: string) {
    // Return users who have ADMIN role attached via role_users
    const users = await this.prisma.user.findMany({
      where: {
        role_users: {
          some: { role: { name: { equals: 'ADMIN', mode: 'insensitive' } } },
        },
      },
    });

    return users;
  }
}
