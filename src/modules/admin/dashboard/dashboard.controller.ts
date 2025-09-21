// src/dashboard/dashboard.controller.ts
import { Controller, Get, UseGuards, Request, Param, ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly prisma: PrismaService
  ) {}

  @Get('admin')
  async getAdminDashboard(): Promise<DashboardResponseDto> {
    try {
      const data = await this.dashboardService.getAdminDashboard();
      return {
        success: true,
        message: 'Admin dashboard data retrieved successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve admin dashboard data',
        data: null,
      };
    }
  }

  @Get('teacher/:id')
  // @Roles('admin', 'teacher')
  async getTeacherDashboard(
    @Param('id') teacherId: string,
    @Request() req,
  ): Promise<DashboardResponseDto> {
    try {
      // Check if the requesting user has admin role
      const isAdmin = await this.userHasRole(req.user.id, 'admin');
      
      // Check if the requesting user is accessing their own dashboard
      const isRequestingOwnData = req.user.id === teacherId;
      
      if (!isAdmin && !isRequestingOwnData) {
        throw new ForbiddenException('You can only access your own teacher dashboard');
      }

      // Verify the requested user has teacher role
      const isTeacher = await this.userHasRole(teacherId, 'teacher');
      if (!isTeacher && !isAdmin) {
        throw new ForbiddenException('Requested user is not a teacher');
      }

      const data = await this.dashboardService.getTeacherDashboard(teacherId);
      return {
        success: true,
        message: 'Teacher dashboard data retrieved successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve teacher dashboard data',
        data: null,
      };
    }
  }

  @Get('teacher')
  async getCurrentTeacherDashboard(
    @Request() req,
  ): Promise<DashboardResponseDto> {
    try {
      // Use the authenticated user's ID
      const teacherId = req.user.id;
      
      // Verify the user has teacher role
      const isTeacher = await this.userHasRole(teacherId, 'teacher');
      if (!isTeacher) {
        throw new ForbiddenException('User is not a teacher');
      }

      const data = await this.dashboardService.getTeacherDashboard(teacherId);
      return {
        success: true,
        message: 'Teacher dashboard data retrieved successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve teacher dashboard data',
        data: null,
      };
    }
  }

  // Helper method to check if a user has a specific role
  private async userHasRole(userId: string, roleName: string): Promise<boolean> {
    const userWithRole = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          where: {
            name: roleName
          }
        }
      }
    });

    return userWithRole && userWithRole.roles.length > 0;
  }
}