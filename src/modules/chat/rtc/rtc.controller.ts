import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RtcService } from './rtc.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { CallKind } from '@prisma/client';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';

@Controller('rtc')
export class RtcController {
  constructor(private readonly rtcService: RtcService) {}

  // Generic token (legacy) - kept for backward compatibility if needed
  @Post('token')
  @UseGuards(JwtAuthGuard)
  async createToken(@GetUser() user: any, @Body() body: CreateTokenDto) {
    const data = await this.rtcService.createToken({
      ...body,
      userId: user.userId,
    });
    return { success: true, data };
  }

  // Start a call explicitly (group or dm)
  @Post('conversations/:id/start')
  @UseGuards(JwtAuthGuard)
  async startCall(
    @GetUser() user: any,
    @Param('id') conversationId: string,
    @Body() body: { kind?: CallKind },
  ) {
    const resp = await this.rtcService.startCall(
      conversationId,
      user.userId,
      body.kind || 'VIDEO',
    );
    return resp;
  }

  // Join existing call (fails if none active)
  @Post('conversations/:id/join')
  @UseGuards(JwtAuthGuard)
  async joinCall(@GetUser() user: any, @Param('id') conversationId: string) {
    const resp = await this.rtcService.joinCall(conversationId, user.userId);
    return resp;
  }

  // Leave call (any member for now from group call only)
  @Post('conversations/:id/leave')
  @UseGuards(JwtAuthGuard)
  async leaveCall(@GetUser() user: any, @Param('id') conversationId: string) {
    const resp = await this.rtcService.leaveCall(conversationId, user.userId);
    return resp;
  }

  // mute microphone
  @Post('conversations/:id/mute')
  @UseGuards(JwtAuthGuard)
  async muteUser(@GetUser() user: any, @Param('id') conversationId: string) {
    const resp = await this.rtcService.muteUser(conversationId, user.userId);
    return resp;
  }

  // Unmute microphone
  @Post('conversations/:id/unmute')
  @UseGuards(JwtAuthGuard)
  async unmuteUser(@GetUser() user: any, @Param('id') conversationId: string) {
    const resp = await this.rtcService.unmuteUser(conversationId, user.userId);
    return resp;
  }

  // camera off
  @Post('conversations/:id/camera-off')
  @UseGuards(JwtAuthGuard)
  async cameraOff(@GetUser() user: any, @Param('id') conversationId: string) {
    const resp = await this.rtcService.cameraOff(conversationId, user.userId);
    return resp;
  }

  // camera on
  @Post('conversations/:id/camera-on')
  @UseGuards(JwtAuthGuard)
  async cameraOn(@GetUser() user: any, @Param('id') conversationId: string) {
    const resp = await this.rtcService.cameraOn(conversationId, user.userId);
    return resp;
  }

  // End call (any member for now)
  @Post('conversations/:id/end')
  @UseGuards(JwtAuthGuard)
  async endCall(@GetUser() user: any, @Param('id') conversationId: string) {
    const resp = await this.rtcService.endCall(conversationId, user.userId);
    return resp;
  }

  // Convenience: issue token bound to conversation call (auto-start if not active)
  @Post('conversations/:id/token')
  @UseGuards(JwtAuthGuard)
  async issueConversationToken(
    @GetUser() user: any,
    @Param('id') conversationId: string,
  ) {
    const data = await this.rtcService.issueCallToken(
      conversationId,
      user.userId,
    );
    return { success: true, data };
  }

  @Get('health')
  health() {
    return this.rtcService.health();
  }
}
