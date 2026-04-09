import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RtcService } from './rtc.service';
import { CallKind } from '@prisma/client';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RealtimeGateway } from '../realtime/realtime.gateway';

import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';

@Controller('rtc')
@DisAllowDeactivated()
export class RtcController {
  constructor(
    private readonly rtcService: RtcService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // Start a call explicitly (group or dm)
  @Post('conversations/:id/start')
  @UseGuards(JwtAuthGuard)
  async startCall(
    @GetUser() user: any,
    @Param('id') conversationId: string,
    @Body() body: { kind?: CallKind },
  ) {
    const kind = body.kind || 'VIDEO';
    const resp = await this.rtcService.startCall(
      conversationId,
      user.userId,
      kind,
    );

    const memberIds = await this.rtcService.getConversationMemberIds(conversationId);
    const recipients = memberIds.filter((id) => id !== user.userId);
    this.realtimeGateway.emitCallIncoming(
      conversationId,
      user.userId,
      kind,
      recipients,
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


  // End call (any member for now)
  @Post('conversations/:id/end')
  @UseGuards(JwtAuthGuard)
  async endCall(@GetUser() user: any, @Param('id') conversationId: string) {
    const resp = await this.rtcService.endCall(conversationId, user.userId);

    const memberIds = await this.rtcService.getConversationMemberIds(conversationId);
    const recipients = memberIds.filter((id) => id !== user.userId);
    this.realtimeGateway.emitCallEnded(conversationId, user.userId, recipients);

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
