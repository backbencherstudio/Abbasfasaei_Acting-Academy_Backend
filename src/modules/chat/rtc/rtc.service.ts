import {
  ForbiddenException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import { CreateTokenDto } from './dto/create-token.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { CallKind } from '@prisma/client';

export interface LivekitTokenResponse {
  token: string;
  roomName: string;
  url: string;
  audioOnlySuggested: boolean;
}

@Injectable()
export class RtcService {
  private readonly apiKey = process.env.LIVEKIT_API_KEY;
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET;
  // Internal URL the server would use if it ever needed to call LiveKit's REST (not required for token signing)
  private readonly url = process.env.LIVEKIT_URL;
  // Public URL handed to browsers (override when container networking differs from client path)
  private readonly publicUrl = process.env.LIVEKIT_PUBLIC_URL || this.url;
  // Allowed room name pattern: slug (lowercase) with optional dashes/underscores, 3-64 chars
  private readonly roomRegex = /^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/;
  private readonly tokenTtlSeconds = 60 * 10; // 10 minutes

  constructor(
    private prisma: PrismaService,
    private convs: ConversationsService,
  ) {}

  validateEnv(): string | null {
    if (!this.apiKey || !this.apiSecret || !this.publicUrl) {
      return 'LiveKit env vars missing (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL or LIVEKIT_PUBLIC_URL)';
    }
    if (this.publicUrl.includes('your-livekit-host')) {
      return 'LIVEKIT_URL is still the placeholder (wss://your-livekit-host:7880). Set it to your LiveKit server, e.g. ws://localhost:7880 for local dev.';
    }
    return null;
  }

  buildRoomName(dto: CreateTokenDto): string {
    if (dto.roomName) {
      if (!this.roomRegex.test(dto.roomName)) {
        throw new BadRequestException('Invalid room name');
      }
      return dto.roomName;
    }
    // fallback disallowed for conversation calls: require explicit conversation room naming
    throw new BadRequestException('roomName required');
  }

  async createToken(dto: CreateTokenDto): Promise<LivekitTokenResponse> {
    try {
      const error = this.validateEnv();

      if (error) {
        throw new Error(error);
      }

      console.log('userId in createToken:', dto.userId);

      if (!dto.userId) {
        throw new Error('userId is required');
      }

      const roomName = this.buildRoomName(dto);
      const at = new AccessToken(this.apiKey!, this.apiSecret!, {
        identity: dto.userId,
        name: dto.displayName || dto.userId,
        ttl: this.tokenTtlSeconds,
      });

      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const jwt = await at.toJwt();
      return {
        token: jwt,
        roomName,
        url: this.publicUrl!,
        audioOnlySuggested: !!dto.audioOnly,
      };
    } catch (error) {
      console.error('Error creating token:', error);
      throw new Error('Failed to create token');
    }
  }

  // ---- Call session lifecycle ----
  // Build a slug from conversation info (title for groups, combined names for DMs) + short id suffix for uniqueness
  private buildConversationRoomName(conv: any): string {
    let base: string;
    if (conv.type === 'GROUP') {
      base = conv.title?.trim() || 'group';
    } else {
      // DM: derive from up to 2 participant names (excluding null). Fallback to 'dm'.
      const names = (conv.memberships || [])
        .map((m) => m.user?.name || '')
        .filter(Boolean)
        .slice(0, 2);
      base = names.length === 2 ? `${names[0]}-${names[1]}` : names[0] || 'dm';
    }
    const slug =
      base
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-') // allowed chars
        .replace(/-{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '')
        .slice(0, 40) || 'room';
    const suffix = conv.id.slice(0, 6).toLowerCase();
    const room = `${slug}-${suffix}`;
    // Ensure fits regex & length boundaries
    if (!this.roomRegex.test(room)) {
      return `room-${suffix}`; // guaranteed fallback
    }
    return room;
  }

  async startCall(conversationId: string, userId: string, kind: CallKind) {
    await this.convs.ensureMember(conversationId, userId);
    // ensure no active session
    const existing = await this.prisma.callSession.findFirst({
      where: { conversationId, endedAt: null },
      select: { id: true },
    });
    if (existing) {
      return { ok: true, alreadyActive: true, callId: existing.id };
    }
    const call = await this.prisma.callSession.create({
      data: { conversationId, kind, startedBy: userId },
      select: { id: true, startedAt: true, kind: true },
    });
    return { ok: true, call };
  }

  async joinCall(conversationId: string, userId: string) {
    await this.convs.ensureMember(conversationId, userId);
    const session = await this.prisma.callSession.findFirst({
      where: { conversationId, endedAt: null },
      select: { id: true },
    });
    if (!session) throw new BadRequestException('No active call');
    // upsert participant (idempotent)
    const existing = await this.prisma.callParticipant.findFirst({
      where: { callId: session.id, userId },
      select: { id: true },
    });
    if (!existing) {
      await this.prisma.callParticipant.create({
        data: { callId: session.id, userId },
      });
    }
    return { ok: true, callId: session.id };
  }

  async leaveCall(conversationId: string, userId: string) {
    await this.convs.ensureMember(conversationId, userId);
    const session = await this.prisma.callSession.findFirst({
      where: { conversationId, endedAt: null },
      select: { id: true },
    });
    if (!session) return { ok: true, alreadyEnded: true };
    await this.prisma.callParticipant.deleteMany({
      where: { callId: session.id, userId },
    });
    return { ok: true };
  }

  async muteUser(conversationId: string, userId: string) {
    await this.convs.ensureMember(conversationId, userId);
    const session = await this.prisma.callSession.findFirst({
      where: { conversationId, endedAt: null },
      select: { id: true },
    });
    if (!session) return { ok: true, alreadyEnded: true };
    await this.prisma.callParticipant.updateMany({
      where: { callId: session.id, userId },
      data: { microphone: 'off' },
    });
    return { ok: true };
  }

  async unmuteUser(conversationId: string, userId: string) {
    await this.convs.ensureMember(conversationId, userId);
    const session = await this.prisma.callSession.findFirst({
      where: { conversationId, endedAt: null },
      select: { id: true },
    });
    if (!session) return { ok: true, alreadyEnded: true };
    await this.prisma.callParticipant.updateMany({
      where: { callId: session.id, userId },
      data: { microphone: 'on' },
    });
    return { ok: true };
  }

  async cameraOff(conversationId: string, userId: string) {
    await this.convs.ensureMember(conversationId, userId);
    const session = await this.prisma.callSession.findFirst({
      where: { conversationId, endedAt: null },
      select: { id: true },
    });
    if (!session) return { ok: true, alreadyEnded: true };
    await this.prisma.callParticipant.updateMany({
      where: { callId: session.id, userId },
      data: { camera: 'off' },
    });
    return { ok: true };
  }

  async cameraOn(conversationId: string, userId: string) {
    await this.convs.ensureMember(conversationId, userId);
    const session = await this.prisma.callSession.findFirst({
      where: { conversationId, endedAt: null },
      select: { id: true },
    });
    if (!session) return { ok: true, alreadyEnded: true };
    await this.prisma.callParticipant.updateMany({
      where: { callId: session.id, userId },
      data: { camera: 'on' },
    });
    return { ok: true };
  }

  async endCall(conversationId: string, userId: string) {
    await this.convs.ensureMember(conversationId, userId);
    const session = await this.prisma.callSession.findFirst({
      where: { conversationId, endedAt: null },
      select: { id: true, startedBy: true },
    });
    if (!session) return { ok: true, alreadyEnded: true };
    if (session.startedBy !== userId) {
      // allow any member to end if starter gone (future enhancement: check presence)
      // For now, permit any member:
    }
    await this.prisma.callSession.update({
      where: { id: session.id },
      data: { endedAt: new Date() },
    });
    return { ok: true };
  }

  async issueCallToken(conversationId: string, userId: string) {
    // Ensure active call session exists (auto start for DM convenience?)
    await this.convs.ensureMember(conversationId, userId);
    let session = await this.prisma.callSession.findFirst({
      where: { conversationId, endedAt: null },
      select: { id: true },
    });
    if (!session) {
      // Auto start for DM, deny for group? We'll auto start universally for simplicity.
      session = await this.prisma.callSession.create({
        data: { conversationId, kind: 'VIDEO', startedBy: userId },
        select: { id: true },
      });
    }
    // Add participant record
    await this.joinCall(conversationId, userId);
    // Fetch conversation details to build human-friendly slug
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        type: true,
        title: true,
        memberships: { select: { user: { select: { name: true } } } },
      },
    });
    if (!conv) throw new BadRequestException('Conversation not found');
    const roomName = this.buildConversationRoomName(conv);
    return this.createToken({ userId, roomName });
  }

  health() {
    const envError = this.validateEnv();
    return {
      ok: !envError,
      error: envError || null,
      url: this.publicUrl,
      apiKeyPresent: !!this.apiKey,
      tokenTtlSeconds: this.tokenTtlSeconds,
    };
  }
}
