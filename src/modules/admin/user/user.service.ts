import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import { NajimStorage } from '../../../common/lib/Disk/NajimStorage';
import { QueryUserDto } from './dto/query-user.dto';
import { Prisma } from '@prisma/client';
import { Role } from 'src/common/guard/role/role.enum';
import { UserStatus } from 'src/common/constants/user-status.enum';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, admin_id: string) {
    if (!admin_id) {
      throw new UnauthorizedException('User not found');
    }

    const user = await UserRepository.createUser(createUserDto);

    if (user.success) {
      return {
        success: user.success,
        message: user.message,
      };
    } else {
      throw new UnprocessableEntityException(
        user.message || 'Error creating user',
      );
    }
  }

  async findAll(query: QueryUserDto, user_id: string) {
    if (!user_id) {
      throw new UnauthorizedException('User not found');
    }

    const { page, limit, status, type, search } = query;
    const where: Prisma.UserWhereInput = {};
    if (search) {
      where['OR'] = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { experience: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where['type'] = type;
    }
    if (status) {
      where['status'] = status;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        status: true,
        phone_number: true,
        type: true,
        approved_at: true,
        created_at: true,
        joined_at: true,
        _count: {
          select: {
            enrollments: true,
            assigned_courses: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.user.count({
      where,
    });

    return {
      success: true,
      message: 'Users fetched successfully',
      data: users.map((user) => {
        const count = user._count;
        const type = user.type;
        delete user._count;
        return {
          ...user,
          status: user.status ? UserStatus[user.status] : null,
          total_enrolled: type === Role.STUDENT ? count.enrollments : 0,
          total_assigned: type === Role.TEACHER ? count.assigned_courses : 0,
          avatar_url: user.avatar ? NajimStorage.url(user.avatar) : null,
        };
      }),
      meta_data: {
        page,
        limit,
        total,
        search,
        type,
        status,
      },
    };
  }

  async findOne(user_id: string, admin_id: string) {
    if (!admin_id) throw new UnauthorizedException('Please login first!');
    const user = await this.prisma.user.findUnique({
      where: {
        id: user_id,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone_number: true,
        experience: true,
        type: true,
        status: true,
        approved_at: true,
        joined_at: true,
        created_at: true,
        avatar: true,
        customer_id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: {
        ...user,
        status: user.status ? UserStatus[user.status] : null,
        avatar_url: user.avatar ? NajimStorage.url(user.avatar) : null,
      },
    };
  }

  async approve(user_id: string, admin_id: string) {
    if (!admin_id) throw new UnauthorizedException('Please login first!');

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });
    if (!user) {
      throw new UnprocessableEntityException('User not found');
    }
    await this.prisma.user.update({
      where: { id: user_id },
      data: { approved_at: new Date() },
    });
    return {
      success: true,
      message: 'User approved successfully',
    };
  }

  async reject(user_id: string, admin_id: string) {
    if (!admin_id) throw new UnauthorizedException('Please login first!');

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });
    if (!user) {
      throw new UnprocessableEntityException('User not found');
    }
    await this.prisma.user.update({
      where: { id: user_id },
      data: { approved_at: null, status: UserStatus.REJECTED },
    });
    return {
      success: true,
      message: 'User rejected successfully',
    };
  }

  async update(
    user_id: string,
    updateUserDto: UpdateUserDto,
    admin_id: string,
  ) {
    if (!admin_id) throw new UnauthorizedException('Please login first!');

    const user = await UserRepository.updateUser(user_id, updateUserDto);

    if (user.success) {
      return {
        success: user.success,
        message: user.message,
      };
    } else {
      throw new UnprocessableEntityException(
        user.message || 'Error updating user',
      );
    }
  }

  async remove(user_id: string, admin_id: string) {
    if (!admin_id) throw new UnauthorizedException('Please login first!');

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id: user_id },
    });

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  async updateStatus(user_id: string, status: UserStatus, admin_id: string) {
    if (!admin_id) throw new UnauthorizedException('Please login first!');
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.update({
      where: { id: user_id },
      data: { status },
    });
    return {
      success: true,
      message: 'User status updated successfully',
    };
  }
}
