import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { UpdateUserSettingsDto } from './dto/update-profile.dto';




@ApiBearerAuth()
@ApiTags('User')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('general-settings')
  async getGeneralSettings() {
    return this.settingsService.allSettings()
  }

  @Get('profile-settings')
  async getProfileSettings(
    @GetUser() user: any,
  ) {
    return this.settingsService.allProfileSettings(user.userId)
  }

  @Post('update-profile')
  async profileUpdate(
    @GetUser() user: any,
    @Body() updateUserDto: UpdateUserSettingsDto
  ) {
    return this.settingsService.profileUpdate(user.userId, updateUserDto)
  }
}
