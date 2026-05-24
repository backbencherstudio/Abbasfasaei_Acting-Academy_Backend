import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { DisAllowDeactivated } from 'src/common/decorators/disallow-deactivated.decorator';
import { RtcService } from './rtc.service';
import {
  ConversationIdParamDto,
  StartCallDto,
  UpdateParticipantMediaDto,
} from './dto/rtc.dto';

@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('rtc')
@DisAllowDeactivated()
export class RtcController {
  constructor(private readonly rtcService: RtcService) {}

  @Get('health')
  health() {
    return this.rtcService.health();
  }

  @Get('conversations/:conversation_id/state')
  getCallState(
    @GetUser('userId') user_id: string,
    @Param() params: ConversationIdParamDto,
  ) {
    return this.rtcService.getCallState(params.conversation_id, user_id);
  }

  @Post('conversations/:conversation_id/start')
  startCall(
    @GetUser('userId') user_id: string,
    @Param() params: ConversationIdParamDto,
    @Body() body: StartCallDto,
  ) {
    return this.rtcService.startCall(params.conversation_id, user_id, body.kind);
  }

  @Post('conversations/:conversation_id/join')
  joinCall(
    @GetUser('userId') user_id: string,
    @Param() params: ConversationIdParamDto,
  ) {
    return this.rtcService.joinCall(params.conversation_id, user_id);
  }

  @Post('conversations/:conversation_id/token')
  issueCallToken(
    @GetUser('userId') user_id: string,
    @Param() params: ConversationIdParamDto,
  ) {
    return this.rtcService.issueCallToken(params.conversation_id, user_id);
  }

  @Post('conversations/:conversation_id/decline')
  declineCall(
    @GetUser('userId') user_id: string,
    @Param() params: ConversationIdParamDto,
  ) {
    return this.rtcService.declineCall(params.conversation_id, user_id);
  }

  @Post('conversations/:conversation_id/leave')
  leaveCall(
    @GetUser('userId') user_id: string,
    @Param() params: ConversationIdParamDto,
  ) {
    return this.rtcService.leaveCall(params.conversation_id, user_id);
  }

  @Post('conversations/:conversation_id/end')
  endCall(
    @GetUser('userId') user_id: string,
    @Param() params: ConversationIdParamDto,
  ) {
    return this.rtcService.endCall(params.conversation_id, user_id);
  }

  @Patch('conversations/:conversation_id/participants/me')
  updateMyParticipantState(
    @GetUser('userId') user_id: string,
    @Param() params: ConversationIdParamDto,
    @Body() body: UpdateParticipantMediaDto,
  ) {
    return this.rtcService.updateMyParticipantState(
      params.conversation_id,
      user_id,
      body,
    );
  }
}
