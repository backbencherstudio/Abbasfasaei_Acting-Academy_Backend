import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  CallKind,
  CallParticipant,
  CallSession,
  CallStatus,
  ConversationType,
  MemberRole,
  MessageKind,
  ReceiptStatus,
} from '@prisma/client';
import { AccessToken } from 'livekit-server-sdk';
import Redis from 'ioredis';
import appConfig from 'src/config/app.config';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChatRepository } from 'src/common/repository/chat/chat.repository';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import { RealtimeGateway } from '../realtime/realtime.gateway';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

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

/** Content stored inside a CALL-kind message. */
type CallMessageContent = {
  call_kind: 'AUDIO' | 'VIDEO';
  /** ONGOING — call in progress. ENDED — completed with duration. MISSED — no one joined / declined. */
  status: 'ONGOING' | 'ENDED' | 'MISSED';
  duration_seconds: number | null;
  reason: string | null;
};

type CallEndReason = 'ended' | 'declined' | 'empty_room';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class RtcService implements OnModuleDestroy {
  private readonly apiKey = process.env.LIVEKIT_API_KEY;
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET;
  private readonly url = process.env.LIVEKIT_URL;
  private readonly publicUrl = process.env.LIVEKIT_PUBLIC_URL || this.url;
  private readonly tokenTtlSeconds = 60 * 10;

  /**
   * Dedicated Redis publisher for broadcasting call messages.
   * Mirrors the pattern used in ChatRepository.
   */
  private readonly redisPublisher: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {
    const cfg = appConfig().redis;
    // Bug C fix: safe fallbacks so undefined env vars never break ioredis.
    this.redisPublisher = new Redis({
      host: cfg.host ?? '127.0.0.1',
      port: Number(cfg.port ?? 6379),
      password: cfg.password || undefined,
      lazyConnect: false,
    });

    this.redisPublisher.on('error', (err) =>
      console.error('[RtcService] Redis publisher error:', err),
    );
  }

  // Bug B fix: clean up the Redis publisher when the NestJS module shuts down.
  async onModuleDestroy() {
    await this.redisPublisher.quit();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

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
    const conversation = await this.getConversationContext(
      conversation_id,
      user_id,
    );
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

    const conversation = await this.getConversationContext(
      conversation_id,
      user_id,
    );
    await this.ensureDmCallingAllowed(conversation, user_id);

    let session = await this.getActiveSession(conversation_id);
    let alreadyActive = false;

    if (!session) {
      const tempRoomName = this.generateRoomName(conversation_id);

      session = await this.prisma.callSession.create({
        data: {
          conversation_id,
          kind,
          started_by: user_id,
          status: CallStatus.ONGOING,
          room_name: tempRoomName,
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

    let callMessage: ReturnType<typeof this.formatCallMessage> | null = null;

    if (!alreadyActive) {
      const recipient_ids = conversation.memberships
        .map((m) => m.user_id)
        .filter((id) => id !== user_id);

      // Create a CALL-kind message before notifying recipients so their
      // timeline can show the ongoing call immediately.
      callMessage = await this.createCallMessage(session, conversation, user_id);

      this.realtimeGateway.emitCallIncoming(recipient_ids, {
        conversation_id,
        call_session_id: session.id,
        message: callMessage,
        room_name: tokenData.room_name,
        kind: session.kind,
        started_by: user_id,
        started_at: session.started_at.toISOString(),
        at: session.started_at.toISOString(),
        conversation_type: conversation.type,
        conversation_title: conversation.title,
        caller: this.serializeUser(
          conversation.memberships.find((m) => m.user_id === user_id)?.user ??
            null,
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
        call_message: callMessage,
      },
    };
  }

  async joinCall(conversation_id: string, user_id: string) {
    this.assertLivekitReady();

    const conversation = await this.getConversationContext(
      conversation_id,
      user_id,
    );
    const session = await this.getRequiredActiveSession(conversation_id);

    const upserted = await this.upsertParticipant(
      session.id,
      user_id,
      session.kind,
    );
    const refreshed = await this.getCallSessionById(session.id);
    const tokenData = await this.createLivekitToken(
      refreshed,
      conversation,
      user_id,
    );

    const recipient_ids = conversation.memberships
      .map((m) => m.user_id)
      .filter((id) => id !== user_id);

    if (!upserted.already_joined) {
      this.realtimeGateway.emitCallJoined(recipient_ids, {
        conversation_id,
        call_session_id: refreshed.id,
        user: this.serializeUser(
          refreshed.participants.find((p) => p.user_id === user_id)?.user ??
            null,
        ),
        participant: this.serializeParticipant(
          refreshed.participants.find((p) => p.user_id === user_id)!,
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

    const conversation = await this.getConversationContext(
      conversation_id,
      user_id,
    );
    const session = await this.getRequiredActiveSession(conversation_id);
    const upserted = await this.upsertParticipant(
      session.id,
      user_id,
      session.kind,
    );
    const refreshed = await this.getCallSessionById(session.id);
    const tokenData = await this.createLivekitToken(
      refreshed,
      conversation,
      user_id,
    );

    if (!upserted.already_joined) {
      const recipient_ids = conversation.memberships
        .map((m) => m.user_id)
        .filter((id) => id !== user_id);

      this.realtimeGateway.emitCallJoined(recipient_ids, {
        conversation_id,
        call_session_id: refreshed.id,
        user: this.serializeUser(
          refreshed.participants.find((p) => p.user_id === user_id)?.user ??
            null,
        ),
        participant: this.serializeParticipant(
          refreshed.participants.find((p) => p.user_id === user_id)!,
        ),
        participant_count: refreshed.participants.length,
        joined_at: upserted.joined_at.toISOString(),
      });
    }

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
    const conversation = await this.getConversationContext(
      conversation_id,
      user_id,
    );
    const session = await this.getRequiredActiveSession(conversation_id);

    const recipient_ids = this.getActiveConversationUserIds(
      conversation,
    ).filter((id) => id !== user_id);

    if (conversation.type === ConversationType.DM) {
      // DM: end the session immediately and mark the call message as MISSED.
      await this.finishCallSession(session.id, 'declined');

      this.realtimeGateway.emitCallEnded(
        this.getActiveConversationUserIds(conversation),
        {
          conversation_id,
          call_session_id: session.id,
          by_user_id: user_id,
          reason: 'declined',
          at: new Date().toISOString(),
        },
      );
    } else {
      // GROUP: keep session alive, just notify others.
      this.realtimeGateway.emitCallDeclined(recipient_ids, {
        conversation_id,
        call_session_id: session.id,
        user_id,
        at: new Date().toISOString(),
      });
    }

    return {
      success: true,
      message: 'Call declined successfully',
    };
  }

  async leaveCall(conversation_id: string, user_id: string) {
    const conversation = await this.getConversationContext(
      conversation_id,
      user_id,
    );
    const session = await this.getRequiredActiveSession(conversation_id);

    const left_participant = await this.markParticipantLeft(
      session.id,
      user_id,
    );
    const remaining_participants = await this.prisma.callParticipant.findMany({
      where: { call_id: session.id, left_at: null },
      select: { user_id: true },
    });

    const should_end_for_everyone = remaining_participants.length === 0;

    if (should_end_for_everyone) {
      await this.finishCallSession(session.id, 'empty_room');

      const recipients = this.getActiveConversationUserIds(conversation);
      this.realtimeGateway.emitCallEnded(recipients, {
        conversation_id,
        call_session_id: session.id,
        by_user_id: user_id,
        reason: 'empty_room',
        at: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Call ended successfully',
      };
    }

    this.realtimeGateway.emitCallLeft(
      this.getActiveConversationUserIds(conversation).filter(
        (id) => id !== user_id,
      ),
      {
        conversation_id,
        call_session_id: session.id,
        user_id,
        left_at:
          left_participant.left_at?.toISOString() || new Date().toISOString(),
        participant_count: remaining_participants.length,
      },
    );

    return {
      success: true,
      message: 'Left call successfully',
    };
  }

  async endCall(conversation_id: string, user_id: string) {
    const conversation = await this.getConversationContext(
      conversation_id,
      user_id,
    );
    const session = await this.getRequiredActiveSession(conversation_id);

    const requester = conversation.memberships.find(
      (m) => m.user_id === user_id,
    );

    const can_end_for_everyone =
      conversation.type === ConversationType.DM ||
      session.started_by === user_id ||
      requester?.role === MemberRole.ADMIN;

    if (!can_end_for_everyone) {
      throw new ForbiddenException(
        'Only the starter or an admin can end this group call',
      );
    }

    await this.finishCallSession(session.id, 'ended');

    this.realtimeGateway.emitCallEnded(
      this.getActiveConversationUserIds(conversation),
      {
        conversation_id,
        call_session_id: session.id,
        by_user_id: user_id,
        reason: 'ended',
        at: new Date().toISOString(),
      },
    );

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
    const conversation = await this.getConversationContext(
      conversation_id,
      user_id,
    );
    const session = await this.getRequiredActiveSession(conversation_id);

    const participant = await this.prisma.callParticipant.findFirst({
      where: { call_id: session.id, user_id, left_at: null },
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
      throw new BadRequestException(
        'At least one participant field is required',
      );
    }

    const updated = await this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: {
        ...(body.camera !== undefined ? { camera: body.camera } : {}),
        ...(body.microphone !== undefined
          ? { microphone: body.microphone }
          : {}),
        ...(body.is_screen_sharing !== undefined
          ? { is_screen_sharing: body.is_screen_sharing }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true } },
      },
    });

    this.realtimeGateway.emitCallParticipantUpdated(
      this.getActiveConversationUserIds(conversation).filter(
        (id) => id !== user_id,
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
      data: { participant: this.serializeParticipant(updated) },
    };
  }

  // -------------------------------------------------------------------------
  // Call Message helpers
  // -------------------------------------------------------------------------

  /**
   * Creates a `MessageKind.CALL` record so the call appears in the chat timeline.
   * Content status is `ONGOING`; it will be updated to ENDED/MISSED when the call finishes.
   * Published to the `chat:messages` Redis channel so the RealtimeGateway fans it out.
   */
  private async createCallMessage(
    session: CallSession,
    conversation: ConversationContext,
    sender_id: string,
  ) {
    const existing = await this.prisma.message.findFirst({
      where: { call_session_id: session.id, kind: MessageKind.CALL },
      select: this.callMessageSelect(),
    });

    if (existing) {
      return this.formatCallMessage(existing);
    }

    const content: CallMessageContent = {
      call_kind: session.kind === CallKind.VIDEO ? 'VIDEO' : 'AUDIO',
      status: 'ONGOING',
      duration_seconds: null,
      reason: null,
    };

    const member_ids = this.getActiveConversationUserIds(conversation);
    const receiptMemberIds = member_ids.filter((id) => id !== sender_id);
    let sentMembers: Array<{ user_id: string }> = [];

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversation_id: session.conversation_id,
          sender_id,
          kind: MessageKind.CALL,
          content,
          call_session_id: session.id,
        },
        select: this.callMessageSelect(),
      });

      if (receiptMemberIds.length > 0) {
        sentMembers = receiptMemberIds.map((user_id) => ({ user_id }));

        await tx.receipt.createMany({
          data: receiptMemberIds.map((user_id) => ({
            message_id: created.id,
            user_id,
            status: ChatRepository.onlineUsers.has(user_id)
              ? ReceiptStatus.DELIVERED
              : ReceiptStatus.SENT,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    const formatted = this.formatCallMessage({
      ...message,
      receipts: sentMembers.map((m) => ({
        status: ChatRepository.onlineUsers.has(m.user_id)
          ? ReceiptStatus.DELIVERED
          : ReceiptStatus.SENT,
        user_id: m.user_id,
      })),
    });

    // Publish via Redis so the existing RealtimeGateway picks it up as `message:new`.
    await this.redisPublisher
      .publish(
        'chat:messages',
        JSON.stringify({
          conversation_id: session.conversation_id,
          msg: formatted,
          target_user_ids: member_ids,
        }),
      )
      .catch((err) =>
        console.error('[RtcService] Redis call message publish failed:', err),
      );

    return formatted;
  }

  /**
   * Updates the call message when the session ends:
   * - Calculates duration.
   * - Marks the message as ENDED or MISSED.
   * - Emits `call:message_updated` so clients can refresh the call card.
   */
  private async finalizeCallMessage(
    call_session_id: string,
    conversation_id: string,
    started_at: Date,
    ended_at: Date,
    reason: CallEndReason,
    member_ids: string[],
  ) {
    // Count every participant that ever joined (including those who left).
    const total_participants = await this.prisma.callParticipant.count({
      where: { call_id: call_session_id },
    });

    // MISSED: only the caller was ever in the room, or the call was explicitly declined.
    const final_status: CallMessageContent['status'] =
      reason === 'declined' || total_participants <= 1 ? 'MISSED' : 'ENDED';

    const duration_seconds =
      final_status === 'ENDED'
        ? Math.round((ended_at.getTime() - started_at.getTime()) / 1000)
        : null;

    // Bug A fix: updateMany cannot safely merge JSON fields — the `call_kind` from the
    // original content would be lost. Instead: fetch first, build merged content, then update.
    const existing = await this.prisma.message.findFirst({
      where: { call_session_id, kind: MessageKind.CALL },
      select: {
        ...this.callMessageSelect(),
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (!existing) return; // no call message found — startCall must have failed silently

    // Preserve call_kind from the original content; override lifecycle fields.
    const originalContent = existing.content as Record<string, unknown> | null;
    const mergedContent: CallMessageContent = {
      call_kind: (originalContent?.['call_kind'] as 'AUDIO' | 'VIDEO') ?? 'VIDEO',
      status: final_status,
      duration_seconds,
      reason,
    };

    await this.prisma.message.update({
      where: { id: existing.id },
      data: { content: mergedContent },
    });

    const formatted = this.formatCallMessage({ ...existing, content: mergedContent });

    // Notify clients — they should upsert by message id.
    this.realtimeGateway.emitCallMessageUpdated(member_ids, {
      message: formatted,
      conversation_id,
    });
  }

  /** Formats a raw call message record to match the standard message shape. */
  private formatCallMessage(message: {
    id: string;
    conversation_id: string;
    kind: string;
    content: unknown;
    created_at: Date;
    deleted_at?: Date | null;
    call_session_id?: string | null;
    receipts?: Array<{ status: string; user_id?: string | null }>;
    sender: { id: string; name: string | null; avatar: string | null };
  }) {
    let status: 'SENT' | 'DELIVERED' | 'READ' = 'SENT';

    if (message.receipts && message.receipts.length > 0) {
      const statuses = message.receipts.map((r) => r.status);
      if (statuses.includes(ReceiptStatus.READ)) {
        status = 'READ';
      } else if (statuses.includes(ReceiptStatus.DELIVERED)) {
        status = 'DELIVERED';
      }
    }

    return {
      id: message.id,
      conversation_id: message.conversation_id,
      kind: message.kind,
      content: message.content,
      call_session_id: message.call_session_id ?? null,
      created_at: message.created_at,
      deleted_at: message.deleted_at ?? null,
      status,
      attachments: [],
      reply_to: null,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        avatar: message.sender.avatar
          ? NajimStorage.url(message.sender.avatar)
          : null,
      },
    };
  }

  private callMessageSelect() {
    return {
      id: true,
      conversation_id: true,
      kind: true,
      content: true,
      created_at: true,
      deleted_at: true,
      call_session_id: true,
      receipts: {
        select: {
          status: true,
          user_id: true,
        },
      },
      sender: { select: { id: true, name: true, avatar: true } },
    } as const;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private validateEnv(): string | null {
    if (!this.apiKey || !this.apiSecret || !this.publicUrl) {
      return 'LiveKit env vars missing (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL or LIVEKIT_PUBLIC_URL)';
    }
    return null;
  }

  private assertLivekitReady() {
    const envError = this.validateEnv();
    if (envError) throw new BadRequestException(envError);
  }

  private callSessionInclude() {
    return {
      participants: {
        where: { left_at: null },
        orderBy: { joined_at: 'asc' as const },
        include: {
          user: {
            select: { id: true, name: true, username: true, avatar: true },
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
              select: { id: true, name: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    if (!conversation) throw new BadRequestException('Conversation not found');
    return conversation;
  }

  private async ensureDmCallingAllowed(
    conversation: ConversationContext,
    user_id: string,
  ) {
    if (conversation.type !== ConversationType.DM) return;

    const other = conversation.memberships.find((m) => m.user_id !== user_id);
    if (!other) throw new BadRequestException('DM participant not found');

    const blocked_by_me = await ChatRepository.checkBlockStatus(
      user_id,
      other.user_id,
    );
    const blocked_me = await ChatRepository.checkBlockStatus(
      other.user_id,
      user_id,
    );

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
    if (!session) throw new BadRequestException('No active call found');
    return session;
  }

  private async getCallSessionById(call_session_id: string) {
    const session = await this.prisma.callSession.findUnique({
      where: { id: call_session_id },
      include: this.callSessionInclude(),
    });
    if (!session) throw new BadRequestException('Call session not found');
    return session;
  }

  private async upsertParticipant(
    call_session_id: string,
    user_id: string,
    kind: CallKind,
  ) {
    const active = await this.prisma.callParticipant.findFirst({
      where: { call_id: call_session_id, user_id, left_at: null },
      orderBy: { joined_at: 'desc' },
    });

    if (active) return { already_joined: true, joined_at: active.joined_at };

    const previous = await this.prisma.callParticipant.findFirst({
      where: { call_id: call_session_id, user_id },
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

    return { already_joined: false, joined_at };
  }

  private async markParticipantLeft(call_session_id: string, user_id: string) {
    const participant = await this.prisma.callParticipant.findFirst({
      where: { call_id: call_session_id, user_id, left_at: null },
      orderBy: { joined_at: 'desc' },
    });

    if (!participant) {
      throw new BadRequestException('You are not currently in this call');
    }

    return this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: { left_at: new Date(), is_screen_sharing: false },
    });
  }

  /**
   * Marks the session as ENDED in DB and updates the call message with duration/status.
   */
  private async finishCallSession(
    call_session_id: string,
    reason: CallEndReason,
  ) {
    const ended_at = new Date();

    const session = await this.prisma.$transaction(async (tx) => {
      await tx.callParticipant.updateMany({
        where: { call_id: call_session_id, left_at: null },
        data: { left_at: ended_at, is_screen_sharing: false },
      });

      return tx.callSession.update({
        where: { id: call_session_id },
        data: { status: CallStatus.ENDED, ended_at },
      });
    });

    // Get all members of the conversation to notify about the updated message.
    const memberIds = await this.prisma.membership
      .findMany({
        where: { conversation_id: session.conversation_id, left_at: null },
        select: { user_id: true },
      })
      .then((rows) => rows.map((r) => r.user_id));

    // Update the call message with final status and duration.
    await this.finalizeCallMessage(
      call_session_id,
      session.conversation_id,
      session.started_at,
      ended_at,
      reason,
      memberIds,
    );
  }

  private generateRoomName(conversation_id: string): string {
    const suffix = Math.random().toString(36).slice(2, 10);
    const candidate = `call-${conversation_id.slice(0, 8)}-${suffix}`;

    if (/^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/.test(candidate)) {
      return candidate;
    }

    return `call-${Date.now()}`;
  }

  private getRoomName(session: CallSession, conversation_id: string): string {
    return session.room_name ?? this.generateRoomName(conversation_id);
  }

  private async createLivekitToken(
    session: CallSession,
    conversation: ConversationContext,
    user_id: string,
  ) {
    const caller = conversation.memberships.find((m) => m.user_id === user_id);
    if (!caller) throw new ForbiddenException('Caller not found in conversation');

    const room_name = this.getRoomName(session, conversation.id);

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
      room_name: this.getRoomName(session, conversation.id),
      conversation: {
        id: conversation.id,
        type: conversation.type,
        title: conversation.title,
        avatar: conversation.avatar
          ? NajimStorage.url(conversation.avatar)
          : null,
      },
      participants: session.participants.map((p) => this.serializeParticipant(p)),
      participant_count: session.participants.length,
      self_participant: this.serializeParticipant(
        session.participants.find((p) => p.user_id === user_id) || null,
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
    if (!participant) return null;

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
    user: {
      id: string;
      name: string | null;
      username: string | null;
      avatar: string | null;
    } | null,
  ) {
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar ? NajimStorage.url(user.avatar) : null,
    };
  }

  private getActiveConversationUserIds(conversation: ConversationContext) {
    return Array.from(
      new Set(conversation.memberships.map((m) => m.user_id)),
    );
  }
}
