import { 
  Controller, 
  Get, 
  Put, 
  Post, 
  Delete, 
  Body, 
  Param, 
  UseGuards,
  Request 
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';


@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Get complete profile info (determines type based on payment history)
  @Get()
  async getProfile(
    @GetUser() user: any,
  ) {
    return this.profileService.getCompleteProfile(user.id);
  }

  // Personal Info endpoints
  @Get('personal-info')
  async getPersonalInfo(@GetUser() user: any,) {
    return this.profileService.getPersonalInfo(user.id);
  }

  @Put('personal-info')
  async updatePersonalInfo(@GetUser() user: any, @Body() updateData: any) {
    return this.profileService.updatePersonalInfo(user.id, updateData);
  }

  // Account Settings endpoints
  @Post('change-password')
  async changePassword(@GetUser() user: any, @Body() passwordData: any) {
    return this.profileService.changePassword(user.id, passwordData);
  }

  @Put('disable-account')
  async disableAccount(@GetUser() user: any,) {
    return this.profileService.disableAccount(user.id);
  }

  @Delete('delete-account')
  async deleteAccount(@GetUser() user: any,) {
    return this.profileService.deleteAccount(user.id);
  }

  // // Push Notification Settings
  // @Get('notification-settings')
  // async getNotificationSettings(@Request() req) {
  //   return this.profileService.getNotificationSettings(req.user.id);
  // }

  // @Put('notification-settings')
  // async updateNotificationSettings(@Request() req, @Body() settings: any) {
  //   return this.profileService.updateNotificationSettings(req.user.id, settings);
  // }

  // // Support (Contact form submission)
  // @Post('support')
  // async submitSupportRequest(@Request() req, @Body() supportData: any) {
  //   return this.profileService.submitSupportRequest(req.user.id, supportData);
  // }

  // Logout
  @Post('logout')
  async logout(@GetUser() user: any,) {
    return this.profileService.logout(user.id);
  }

  // Active User Only Endpoints
  // @Get('subscription-payment')
  // async getSubscriptionPayment(@Request() req) {
  //   return this.profileService.getSubscriptionPayment(req.user.id);
  // }

  // @Get('contract-documents')
  // async getContractDocuments(@Request() req) {
  //   return this.profileService.getContractDocuments(req.user.id);
  // }

  // @Get('feedback-certificates')
  // async getFeedbackCertificates(@Request() req) {
  //   return this.profileService.getFeedbackCertificates(req.user.id);
  // }
}