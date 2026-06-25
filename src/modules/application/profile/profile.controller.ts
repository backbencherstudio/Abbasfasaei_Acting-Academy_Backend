import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

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

  // Account Settings endpoints
  // @Post('change-password')
  // async changePassword(@GetUser() user: any, @Body() passwordData: any) {
  //   return this.profileService.changePassword(user.userId, passwordData);
  // }

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

  // // Push Notification Settings
  // @Get('notification-settings')
  // async getNotificationSettings(@Request() req) {
  //   return this.profileService.getNotificationSettings(req.user.userId);
  // }

  // @Put('notification-settings')
  // async updateNotificationSettings(@Request() req, @Body() settings: any) {
  //   return this.profileService.updateNotificationSettings(req.user.userId, settings);
  // }

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
  @Post('logout')
  async logout(@GetUser() user: any) {
    return this.profileService.logout(user.userId);
  }

  // Active User Only Endpoints
  // @Get('subscription-payment')
  // async getSubscriptionPayment(@Request() req) {
  //   return this.profileService.getSubscriptionPayment(req.user.userId);
  // }

  @Get('signed_documents')
  @DisAllowDeactivated()
  async getSignedDocuments(@GetUser() user: any) {
    return this.profileService.getSignedDocuments(user.userId);
  }
}
