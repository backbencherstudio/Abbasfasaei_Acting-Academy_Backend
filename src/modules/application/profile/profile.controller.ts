import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { QueryPaymentHistoryDto } from './dto/query-profile.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Personal Info endpoints
  @UseGuards(JwtAuthGuard)
  @Get('personal-info')
  @DisAllowDeactivated()
  async getPersonalInfo(@GetUser() user: any) {
    return this.profileService.getPersonalInfo(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('personal-info')
  @DisAllowDeactivated()
  async updatePersonalInfo(@GetUser() user: any, @Body() updateData: any) {
    return this.profileService.updatePersonalInfo(user.userId, updateData);
  }

  @UseGuards(JwtAuthGuard)
  @Put('disable-account')
  @DisAllowDeactivated()
  async disableAccount(@GetUser() user: any) {
    return this.profileService.disableAccount(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  @DisAllowDeactivated()
  async deleteAccount(@GetUser() user: any) {
    return this.profileService.deleteAccount(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('activate-account')
  async activateAccount(@GetUser() user: any) {
    return this.profileService.activateAccount(user.userId);
  }

  // Push Notification Settings Toggle
  @UseGuards(JwtAuthGuard)
  @Put('notification-settings')
  @DisAllowDeactivated()
  async updateNotificationSettings(
    @GetUser('userId') user_id: string,
    @Body() settings: UpdateProfileDto,
  ) {
    return this.profileService.updateNotificationSettings(user_id, settings);
  }

  // Support (Contact form submission)
  @UseGuards(JwtAuthGuard)
  @Post('support')
  async submitSupportRequest(
    @GetUser('userId') user_id: string,
    @Body()
    Body: {
      name?: string;
      email?: string;
      phone_number?: string;
      reason?: string;
      message: string;
    },
  ) {
    return this.profileService.submitSupportRequest(user_id, Body);
  }

  // Logout
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@GetUser() user: any) {
    return this.profileService.logout(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('signed_documents')
  @DisAllowDeactivated()
  async getSignedDocuments(@GetUser('userId') user_id: string) {
    return this.profileService.getSignedDocuments(user_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payment-history')
  @DisAllowDeactivated()
  async getPaymentHistory(
    @GetUser('userId') user_id: string,
    @Query() query: QueryPaymentHistoryDto,
  ) {
    return this.profileService.getPaymentHistory(user_id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-courses')
  @DisAllowDeactivated()
  async getMyCourses(@GetUser('userId') user_id: string) {
    return this.profileService.getMyCourses(user_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-courses/:id/details')
  @DisAllowDeactivated()
  async getCourseDetails(
    @GetUser('userId') user_id: string,
    @Param('id') id: string,
  ) {
    return this.profileService.getCourseDetails(user_id, id);
  }
}
