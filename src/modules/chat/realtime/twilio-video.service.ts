// src/realtime/twilio-video.service.ts
import { Injectable } from '@nestjs/common';
import twilio, { jwt, Twilio as TwilioClient } from 'twilio';

type RoomStatus = 'in-progress' | 'completed' | 'failed' | 'unknown';

@Injectable()
export class TwilioVideoService {
  private client: TwilioClient;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('Missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN env vars');
    }
    this.client = twilio(accountSid, authToken);
  }

  private roomNameFor(conversationId: string) {
    return `conv:${conversationId}`;
  }

  /** Find an in-progress room by uniqueName, else create a Group Room. */
  async ensureRoom(conversationId: string) {
    const uniqueName = this.roomNameFor(conversationId);

    // 1) if there’s already an in-progress room with that uniqueName, reuse it
    const existing = await this.client.video.rooms.list({
      uniqueName,
      status: 'in-progress',
      limit: 1,
    });
    if (existing.length) return existing[0];

    // 2) otherwise create a Group room (recommended/default for new accounts)
    try {
      const room = await this.client.video.rooms.create({
        uniqueName,
        type: 'group', // new accounts: Group Rooms only
        recordParticipantsOnConnect: false,
      });
      return room;
    } catch (err: any) {
      // 53113 = "Room exists" race: fetch again and return it
      if (err?.code === 53113) {
        const again = await this.client.video.rooms.list({
          uniqueName,
          status: 'in-progress',
          limit: 1,
        });
        if (again.length) return again[0];
      }
      throw err;
    }
  }

  /** Mint a short-lived Access Token scoped to this conversation/room. */
  generateToken(conversationId: string, identity: string, ttlSec = 3600) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const apiKeySid  = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    if (!apiKeySid || !apiKeySecret) {
      throw new Error('Missing TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET env vars');
    }

    const token = new jwt.AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: identity,
      ttl: ttlSec,
    });

    const grant = new jwt.AccessToken.VideoGrant({
      room: this.roomNameFor(conversationId),
    });
    token.addGrant(grant);

    return token.toJwt();
  }

  /** End the current in-progress room for a conversation (if any). */
  async endRoom(conversationId: string) {
    const uniqueName = this.roomNameFor(conversationId);
    const rooms = await this.client.video.rooms.list({
      uniqueName,
      status: 'in-progress',
      limit: 1,
    });
    if (!rooms.length) return { ok: true, already: true as const };
    await this.client.video.rooms(rooms[0].sid).update({ status: 'completed' });
    return { ok: true, sid: rooms[0].sid };
  }

  /** Optional helper to peek status. */
  async getStatus(conversationId: string): Promise<RoomStatus> {
    const uniqueName = this.roomNameFor(conversationId);
    const rooms = await this.client.video.rooms.list({ uniqueName, limit: 1 });
    if (!rooms.length) return 'unknown';
    return (rooms[0].status as RoomStatus) ?? 'unknown';
  }
}
