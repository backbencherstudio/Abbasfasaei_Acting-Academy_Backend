import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { SazedStorage } from '../../../common/lib/Disk/SazedStorage';
import { DateHelper } from '../../../common/helper/date.helper';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const user = await UserRepository.createUser(createUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll({
    q,
    type,
    approved,
  }: {
    q?: string;
    type?: string;
    approved?: string;
  }) {
    try {
      const where_condition = {};
      if (q) {
        where_condition['OR'] = [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }

      if (type) {
        where_condition['type'] = type;
      }

      if (approved) {
        where_condition['approved_at'] =
          approved == 'approved' ? { not: null } : { equals: null };
      }

      const users = await this.prisma.user.findMany({
        where: {
          ...where_condition,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
          address: true,
          type: true,
          role_users: { select: { role: { select: { name: true } } } },
          approved_at: true,
          created_at: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        data: users,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
          role_users: { select: { role: { select: { name: true } } } },
          phone_number: true,
          approved_at: true,
          created_at: true,
          updated_at: true,
          avatar: true,
          billing_id: true,
        },
      });

      // add avatar url to user
      if (user.avatar) {
        user['avatar_url'] = SazedStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
        );
      }

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async approve(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      await this.prisma.user.update({
        where: { id: id },
        data: { approved_at: DateHelper.now() },
      });
      return {
        success: true,
        message: 'User approved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async reject(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      await this.prisma.user.update({
        where: { id: id },
        data: { approved_at: null },
      });
      return {
        success: true,
        message: 'User rejected successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await UserRepository.updateUser(id, updateUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string) {
    try {
      const user = await UserRepository.deleteUser(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async assignRole(id: string, body: any) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Validate requested role from body
      const requested = String(body?.role || '').toUpperCase();
      const allowed = ['ADMIN', 'TEACHER', 'STUDENT'];
      if (!allowed.includes(requested)) {
        return {
          success: false,
          message: `Invalid role. Allowed roles: ${allowed.join(', ')}`,
        };
      }

      // Find (or create) the requested role (case-insensitive)
      let targetRole = await this.prisma.role.findFirst({
        where: { name: { equals: requested, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (!targetRole) {
        targetRole = await this.prisma.role.create({
          data: {
            name: requested,
            title: requested.charAt(0) + requested.slice(1).toLowerCase(),
          },
          select: { id: true, name: true },
        });
      }

      // Enforce a single role per user: remove previous roles, then attach the chosen one
      await this.prisma.$transaction([
        this.prisma.roleUser.deleteMany({ where: { user_id: id } }),
        this.prisma.roleUser.create({
          data: { user_id: id, role_id: targetRole.id },
        }),
      ]);
      return {
        success: true,
        message: `User role set to ${requested} successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  //-------------------- get all instructors --------------------//
  async getAllInstructors() {
    try {
      const instructors = await this.prisma.user.findMany({
        where: {
          role_users: {
            some: {
              role: { name: { equals: 'TEACHER', mode: 'insensitive' } },
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          about: true,
          phone_number: true,
          address: true,
          avatar: true,
          role_users: { select: { role: { select: { name: true } } } },
        },
      });
      return {
        success: true,
        data: instructors,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  //-------------------- get all students --------------------//
  async getAllStudents() {
    try {
      const students = await this.prisma.user.findMany({
        where: {
          role_users: {
            some: {
              role: { name: { equals: 'STUDENT', mode: 'insensitive' } },
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role_users: { select: { role: { select: { name: true } } } },
          phone_number: true,
          address: true,
          avatar: true,
          ActingGoals: true,
        },
      });
      return {
        success: true,
        data: students,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  //-------------------- get all admins --------------------//
  async getAllAdmins() {
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          role_users: {
            some: { role: { name: { equals: 'ADMIN', mode: 'insensitive' } } },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role_users: { select: { role: { select: { name: true } } } },
        },
      });
      return {
        success: true,
        data: admins,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
