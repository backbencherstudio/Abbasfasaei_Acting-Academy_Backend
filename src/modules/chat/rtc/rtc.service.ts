import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  CallKind,
  CallParticipant,
  CallSession,
  CallStatus,
  ConversationType,
  MemberRole,
} from '@prisma/client';
import { AccessToken } from 'livekit-server-sdk';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChatRepository } from 'src/common/repository/chat/chat.repository';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type ConversationContext = {
  id: string;
  type: ConversationType;
  title: string | null;
  avatar: string | null;
  memberships: Array<{
    user_id: string;
    role: MemberRole;
    user: {
      id: string;
      name: string | null;
      username: string | null;
      avatar: string | null;
    };
  }>;
};

type CallSessionWithParticipants = CallSession & {
  participants: Array<
    CallParticipant & {
      user: {
        id: string;
        name: string | null;
        username: string | null;
        avatar: string | null;
      };
    }
  >;
};

@Injectable()
export class RtcService {
  private readonly apiKey = process.env.LIVEKIT_API_KEY;
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET;
  private readonly url = process.env.LIVEKIT_URL;
  private readonly publicUrl = process.env.LIVEKIT_PUBLIC_URL || this.url;
  private readonly roomRegex = /^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/;
  private readonly tokenTtlSeconds = 60 * 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  health() {
    const envError = this.validateEnv();
    return {
      ok: !envError,
      error: envError,
      url: this.publicUrl || null,
      api_key_present: !!this.apiKey,
      token_ttl_seconds: this.tokenTtlSeconds,
    };
  }

  async getCallState(conversation_id: string, user_id: string) {
    const conversation = await this.getConversationContext(conversation_id, user_id);
    const activeSession = await this.getActiveSession(conversation_id);

    return {
      success: true,
      message: activeSession
        ? 'Active call fetched successfully'
        : 'No active call found',
      data: activeSession
        ? this.serializeCallSession(activeSession, conversation, user_id)
        : null,
    };
  }

  async startCall(
    conversation_id: string,
    user_id: string,
    kind: CallKind = CallKind.VIDEO,
  ) {
    this.assertLivekitReady();

    const conversation = await this.getConversationContext(conversation_id, user_id);
    await this.ensureDmCallingAllowed(conversation, user_id);

    let session = await this.getActiveSession(conversation_id);
    let alreadyActive = false;

    if (!session) {
      session = await this.prisma.callSession.create({
        data: {
          conversation_id,
          kind,
          started_by: user_id,
          status: CallStatus.ONGOING,
        },
        include: this.callSessionInclude(),
      });
    } else {
      alreadyActive = true;
    }

    await this.upsertParticipant(session.id, user_id, session.kind);
    session = await this.getCallSessionById(session.id);

    const tokenData = await this.createLivekitToken(
      session,
      conversation,
      user_id,
    );

    if (!alreadyActive) {
      const recipient_ids = conversation.memberships
        .map((membership) => membership.user_id)
        .filter((memberId) => memberId !== user_id);

      this.realtimeGateway.emitCallIncoming(recipient_ids, {
        conversation_id,
        call_session_id: session.id,
        room_name: tokenData.room_name,
        kind: session.kind,
        started_by: user_id,
        started_at: session.started_at.toISOString(),
        at: session.started_at.toISOString(),
        conversation_type: conversation.type,
        conversation_title: conversation.title,
        caller: this.serializeUser(
          conversation.memberships.find((membership) => membership.user_id === user_id)
            ?.user ?? null,
        ),
      });
    }

    return {
      success: true,
      message: alreadyActive
        ? 'Active call already exists'
        : 'Call started successfully',
      data: {
        ...this.serializeCallSession(session, conversation, user_id),
        livekit: tokenData,
        already_active: alreadyActive,
      },
    };
  }

  async joinCall(conversation_id: string, user_id: string) {
    this.assertLivekitReady();

    const conversation = await this.getConversationContext(conversation_id, user_id);
    const session = await this.getRequiredActiveSession(conversation_id);

    const upserted = await this.upsertParticipant(session.id, user_id, session.kind);
    const refreshed = await this.getCallSessionById(session.id);
    const tokenData = await this.createLivekitToken(
      refreshed,
      conversation,
      user_id,
    );

    const recipient_ids = conversation.memberships
      .map((membership) => membership.user_id)
      .filter((memberId) => memberId !== user_id);

    if (!upserted.already_joined) {
      this.realtimeGateway.emitCallJoined(recipient_ids, {
        conversation_id,
        call_session_id: refreshed.id,
        user: this.serializeUser(
          refreshed.participants.find((participant) => participant.user_id === user_id)
            ?.user ?? null,
        ),
        participant: this.serializeParticipant(
          refreshed.participants.find((participant) => participant.user_id === user_id)!,
        ),
        participant_count: refreshed.participants.length,
        joined_at: upserted.joined_at.toISOString(),
      });
    }

    return {
      success: true,
      message: upserted.already_joined
        ? 'Already joined active call'
        : 'Joined call successfully',
      data: {
        ...this.serializeCallSession(refreshed, conversation, user_id),
        livekit: tokenData,
      },
    };
  }

  async issueCallToken(conversation_id: string, user_id: string) {
    this.assertLivekitReady();

    const conversation = await this.getConversationContext(conversation_id, user_id);
    const session = await this.getRequiredActiveSession(conversation_id);
    await this.upsertParticipant(session.id, user_id, session.kind);
    const refreshed = await this.getCallSessionById(session.id);
    const tokenData = await this.createLivekitToken(
      refreshed,
      conversation,
      user_id,
    );

    return {
      success: true,
      message: 'Call token issued successfully',
      data: {
        ...this.serializeCallSession(refreshed, conversation, user_id),
        livekit: tokenData,
      },
    };
  }

  async declineCall(conversation_id: string, user_id: string) {
    const conversation = await this.getConversationContext(conversation_id, user_id);
    const session = await this.getRequiredActiveSession(conversation_id);

    const recipient_ids = this.getActiveConversationUserIds(conversation).filter(
      (memberId) => memberId !== user_id,
    );

    this.realtimeGateway.emitCallDeclined(recipient_ids, {
      conversation_id,
      call_session_id: session.id,
      user_id,
      at: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Call declined successfully',
    };
  }

  async leaveCall(conversation_id: string, user_id: string) {
    const conversation = await this.getConversationContext(conversation_id, user_id);
    const session = await this.getRequiredActiveSession(conversation_id);

    const left_participant = await this.markParticipantLeft(session.id, user_id);
    const remaining_participants = await this.prisma.callParticipant.findMany({
      where: {
        call_id: session.id,
        left_at: null,
      },
      select: { user_id: true },
    });

    const should_end_for_everyone =
      conversation.type === ConversationType.DM || remaining_participants.length === 0;

    if (should_end_for_everyone) {
      await this.finishCallSession(session.id);

      const recipients = this.getActiveConversationUserIds(conversation);
      this.realtimeGateway.emitCallEnded(recipients, {
        conversation_id,
        call_session_id: session.id,
        by_user_id: user_id,
        reason: conversation.type === ConversationType.DM ? 'hangup' : 'empty_room',
        at: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Call ended successfully',
      };
    }

    this.realtimeGateway.emitCallLeft(
      this.getActiveConversationUserIds(conversation).filter(
        (memberId) => memberId !== user_id,
      ),
      {
        conversation_id,
        call_session_id: session.id,
        user_id,
        left_at: left_participant.left_at?.toISOString() || new Date().toISOString(),
        participant_count: remaining_participants.length,
      },
    );

    return {
      success: true,
      message: 'Left call successfully',
    };
  }

  async endCall(conversation_id: string, user_id: string) {
    const conversation = await this.getConversationContext(conversation_id, user_id);
    const session = await this.getRequiredActiveSession(conversation_id);

    const requester = conversation.memberships.find(
      (membership) => membership.user_id === user_id,
    );

    const can_end_for_everyone =
      conversation.type === ConversationType.DM ||
      session.started_by === user_id ||
      requester?.role === MemberRole.ADMIN;

    if (!can_end_for_everyone) {
      throw new ForbiddenException('Only the starter or an admin can end this group call');
    }

    await this.finishCallSession(session.id);

    this.realtimeGateway.emitCallEnded(this.getActiveConversationUserIds(conversation), {
      conversation_id,
      call_session_id: session.id,
      by_user_id: user_id,
      reason: 'ended',
      at: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Call ended successfully',
    };
  }

  async updateMyParticipantState(
    conversation_id: string,
    user_id: string,
    body: {
      camera?: boolean;
      microphone?: boolean;
      is_screen_sharing?: boolean;
    },
  ) {
    const conversation = await this.getConversationContext(conversation_id, user_id);
    const session = await this.getRequiredActiveSession(conversation_id);

    const participant = await this.prisma.callParticipant.findFirst({
      where: {
        call_id: session.id,
        user_id,
        left_at: null,
      },
      orderBy: { joined_at: 'desc' },
    });

    if (!participant) {
      throw new BadRequestException('You are not currently in this call');
    }

    if (
      body.camera === undefined &&
      body.microphone === undefined &&
      body.is_screen_sharing === undefined
    ) {
      throw new BadRequestException('At least one participant field is required');
    }

    const updated = await this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: {
        ...(body.camera !== undefined ? { camera: body.camera } : {}),
        ...(body.microphone !== undefined ? { microphone: body.microphone } : {}),
        ...(body.is_screen_sharing !== undefined
          ? { is_screen_sharing: body.is_screen_sharing }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    this.realtimeGateway.emitCallParticipantUpdated(
      this.getActiveConversationUserIds(conversation).filter(
        (memberId) => memberId !== user_id,
      ),
      {
        conversation_id,
        call_session_id: session.id,
        participant: this.serializeParticipant(updated),
      },
    );

    return {
      success: true,
      message: 'Participant media state updated successfully',
      data: {
        participant: this.serializeParticipant(updated),
      },
    };
  }

  private validateEnv(): string | null {
    if (!this.apiKey || !this.apiSecret || !this.publicUrl) {
      return 'LiveKit env vars missing (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL or LIVEKIT_PUBLIC_URL)';
    }

    return null;
  }

  private assertLivekitReady() {
    const envError = this.validateEnv();
    if (envError) {
      throw new BadRequestException(envError);
    }
  }

  private callSessionInclude() {
    return {
      participants: {
        where: { left_at: null },
        orderBy: { joined_at: 'asc' as const },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
      },
    };
  }

  private async getConversationContext(
    conversation_id: string,
    user_id: string,
  ): Promise<ConversationContext> {
    if (!conversation_id) {
      throw new BadRequestException('Conversation id is required');
    }

    await ChatRepository.ensureMember(conversation_id, user_id);

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversation_id },
      select: {
        id: true,
        type: true,
        title: true,
        avatar: true,
        memberships: {
          where: { left_at: null },
          orderBy: { joined_at: 'asc' },
          select: {
            user_id: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new BadRequestException('Conversation not found');
    }

    return conversation;
  }

  private async ensureDmCallingAllowed(
    conversation: ConversationContext,
    user_id: string,
  ) {
    if (conversation.type !== ConversationType.DM) {
      return;
    }

    const other = conversation.memberships.find((member) => member.user_id !== user_id);

    if (!other) {
      throw new BadRequestException('DM participant not found');
    }

    const blocked_by_me = await ChatRepository.checkBlockStatus(user_id, other.user_id);
    const blocked_me = await ChatRepository.checkBlockStatus(other.user_id, user_id);

    if (blocked_by_me || blocked_me) {
      throw new ForbiddenException('Calling is not allowed for blocked users');
    }
  }

  private async getActiveSession(
    conversation_id: string,
  ): Promise<CallSessionWithParticipants | null> {
    return this.prisma.callSession.findFirst({
      where: {
        conversation_id,
        status: CallStatus.ONGOING,
        ended_at: null,
      },
      orderBy: { started_at: 'desc' },
      include: this.callSessionInclude(),
    });
  }

  private async getRequiredActiveSession(conversation_id: string) {
    const session = await this.getActiveSession(conversation_id);
    if (!session) {
      throw new BadRequestException('No active call found');
    }
    return session;
  }

  private async getCallSessionById(call_session_id: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: call_session_id },
      include: this.callSessionInclude(),
    });

    if (!session) {
      throw new BadRequestException('Call session not found');
    }

    return session;
  }

  private async upsertParticipant(
    call_session_id: string,
    user_id: string,
    kind: CallKind,
  ) {
    const active = await this.prisma.callParticipant.findFirst({
      where: {
        call_id: call_session_id,
        user_id,
        left_at: null,
      },
      orderBy: { joined_at: 'desc' },
    });

    if (active) {
      return {
        already_joined: true,
        joined_at: active.joined_at,
      };
    }

    const previous = await this.prisma.callParticipant.findFirst({
      where: {
        call_id: call_session_id,
        user_id,
      },
      orderBy: { joined_at: 'desc' },
    });

    const joined_at = new Date();

    if (previous) {
      await this.prisma.callParticipant.update({
        where: { id: previous.id },
        data: {
          joined_at,
          left_at: null,
          camera: kind === CallKind.VIDEO,
          microphone: true,
          is_screen_sharing: false,
        },
      });
    } else {
      await this.prisma.callParticipant.create({
        data: {
          call_id: call_session_id,
          user_id,
          joined_at,
          camera: kind === CallKind.VIDEO,
          microphone: true,
          is_screen_sharing: false,
        },
      });
    }

    return {
      already_joined: false,
      joined_at,
    };
  }

  private async markParticipantLeft(call_session_id: string, user_id: string) {
    const participant = await this.prisma.callParticipant.findFirst({
      where: {
        call_id: call_session_id,
        user_id,
        left_at: null,
      },
      orderBy: { joined_at: 'desc' },
    });

    if (!participant) {
      throw new BadRequestException('You are not currently in this call');
    }

    return this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: {
        left_at: new Date(),
        is_screen_sharing: false,
      },
    });
  }

  private async finishCallSession(call_session_id: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.callParticipant.updateMany({
        where: {
          call_id: call_session_id,
          left_at: null,
        },
        data: {
          left_at: new Date(),
          is_screen_sharing: false,
        },
      });

      await tx.callSession.update({
        where: { id: call_session_id },
        data: {
          status: CallStatus.ENDED,
          ended_at: new Date(),
        },
      });
    });
  }

  private buildRoomName(conversation: ConversationContext, session: CallSession) {
    const base =
      conversation.type === ConversationType.GROUP
        ? conversation.title?.trim() || 'group-call'
        : 'dm-call';

    const slug =
      base
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '')
        .slice(0, 24) || 'call';

    const room_name = `${slug}-${conversation.id.slice(0, 8)}-${session.id.slice(0, 8)}`;

    if (!this.roomRegex.test(room_name)) {
      return `call-${conversation.id.slice(0, 8)}-${session.id.slice(0, 8)}`;
    }

    return room_name;
  }

  private async createLivekitToken(
    session: CallSession,
    conversation: ConversationContext,
    user_id: string,
  ) {
    const caller = conversation.memberships.find(
      (membership) => membership.user_id === user_id,
    );

    if (!caller) {
      throw new ForbiddenException('Caller not found in conversation');
    }

    const room_name = this.buildRoomName(conversation, session);

    const token = new AccessToken(this.apiKey!, this.apiSecret!, {
      identity: user_id,
      name: caller.user.name || caller.user.username || user_id,
      ttl: this.tokenTtlSeconds,
    });

    token.addGrant({
      room: room_name,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      token: await token.toJwt(),
      url: this.publicUrl!,
      room_name,
      audio_only_suggested: session.kind === CallKind.AUDIO,
    };
  }

  private serializeCallSession(
    session: CallSessionWithParticipants,
    conversation: ConversationContext,
    user_id: string,
  ) {
    return {
      id: session.id,
      conversation_id: session.conversation_id,
      kind: session.kind,
      status: session.status,
      started_by: session.started_by,
      started_at: session.started_at,
      ended_at: session.ended_at,
      room_name: this.buildRoomName(conversation, session),
      conversation: {
        id: conversation.id,
        type: conversation.type,
        title: conversation.title,
        avatar: conversation.avatar ? NajimStorage.url(conversation.avatar) : null,
      },
      participants: session.participants.map((participant) =>
        this.serializeParticipant(participant),
      ),
      participant_count: session.participants.length,
      self_participant: this.serializeParticipant(
        session.participants.find((participant) => participant.user_id === user_id) || null,
      ),
    };
  }

  private serializeParticipant(
    participant:
      | (CallParticipant & {
          user: {
            id: string;
            name: string | null;
            username: string | null;
            avatar: string | null;
          };
        })
      | null,
  ) {
    if (!participant) {
      return null;
    }

    return {
      id: participant.id,
      user_id: participant.user_id,
      joined_at: participant.joined_at,
      left_at: participant.left_at,
      camera: participant.camera,
      microphone: participant.microphone,
      is_screen_sharing: participant.is_screen_sharing,
      user: this.serializeUser(participant.user),
    };
  }

  private serializeUser(
    user:
      | {
          id: string;
          name: string | null;
          username: string | null;
          avatar: string | null;
        }
      | null,
  ) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar ? NajimStorage.url(user.avatar) : null,
    };
  }

  private getActiveConversationUserIds(conversation: ConversationContext) {
    return Array.from(new Set(conversation.memberships.map((membership) => membership.user_id)));
  }
}
