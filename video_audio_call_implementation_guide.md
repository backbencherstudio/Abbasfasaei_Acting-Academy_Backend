# Video/Audio Call Implementation Guide

এই guide-টা web, Next.js এবং Flutter developer-দের জন্য। Backend already call signaling, call message, socket notification এবং LiveKit token দেয়। Frontend-এর কাজ হলো ঠিক order-এ API call করা, socket event listen করা, এবং LiveKit room connect/disconnect করা।

Backend stack: NestJS, Socket.IO, Redis, Prisma, PostgreSQL, LiveKit.

Related file:
- Socket guide: `socket_implementation_guide.md`
- Backend controller: `src/modules/chat/rtc/rtc.controller.ts`
- Backend service: `src/modules/chat/rtc/rtc.service.ts`

## 1. Base URL

HTTP API-তে global prefix আছে:

```txt
HTTP API base: http://localhost:4000/api
Socket base:   http://localhost:4000/ws
```

Production হলে domain বদলাবে:

```txt
NEXT_PUBLIC_API_URL=https://api.example.com/api
NEXT_PUBLIC_SOCKET_URL=https://api.example.com
```

Socket.IO namespace `/ws`; এখানে `/api` লাগবে না।

## 2. Main Concept

Call system তিন ভাগে কাজ করে:

| Layer | কাজ | Client কী করবে |
| --- | --- | --- |
| REST API | call start, join, decline, leave, end, token, media state | `fetch` বা HTTP client দিয়ে call করবে |
| Socket.IO | incoming call, participant update, call ended, call message update | event listen করবে |
| LiveKit | আসল audio/video stream | backend দেওয়া `livekit.url` এবং `livekit.token` দিয়ে connect করবে |

Important:
- Audio/video backend দিয়ে যায় না; LiveKit room দিয়ে যায়।
- `POST /rtc/conversations/:id/start` successful হলেই backend `CALL` kind message create করে।
- Call শেষ হলে ওই একই message update হয়ে `MISSED` বা `ENDED` হয়।
- Receiver browser/app বন্ধ থাকলে `call:incoming` event পাবে না। Browser/app open হলে frontend-কে `GET /rtc/conversations/:id/state` call করে active call আছে কি না check করতে হবে।

## 3. Required Packages

Next.js:

```bash
npm i socket.io-client livekit-client
```

Flutter:

```yaml
dependencies:
  socket_io_client: ^3.0.0
  livekit_client: ^2.3.0
  http: ^1.2.0
```

Flutter permissions:

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.INTERNET" />
```

```xml
<!-- ios/Runner/Info.plist -->
<key>NSCameraUsageDescription</key>
<string>Video call er jonno camera permission lagbe</string>
<key>NSMicrophoneUsageDescription</key>
<string>Call er jonno microphone permission lagbe</string>
```

## 4. REST API Contract

সব request-এ header লাগবে:

```txt
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### 4.1 Health

```txt
GET /rtc/health
```

Use: LiveKit env ঠিক আছে কি না check.

Response:

```json
{
  "ok": true,
  "error": null,
  "url": "wss://livekit.example.com",
  "api_key_present": true,
  "token_ttl_seconds": 600
}
```

### 4.2 Active Call State

```txt
GET /rtc/conversations/:conversation_id/state
```

Use:
- Conversation open করলে call chip/ringing দেখাতে।
- Browser/app reconnect করলে missed incoming event recover করতে।
- Socket reconnect হলে current truth sync করতে।

No active call:

```json
{
  "success": true,
  "message": "No active call found",
  "data": null
}
```

Active call:

```json
{
  "success": true,
  "message": "Active call fetched successfully",
  "data": {
    "id": "call_session_id",
    "conversation_id": "conversation_id",
    "kind": "VIDEO",
    "status": "ONGOING",
    "started_by": "caller_user_id",
    "started_at": "2026-06-04T10:00:00.000Z",
    "ended_at": null,
    "room_name": "call-abc12345-x9k2m8pq",
    "conversation": {
      "id": "conversation_id",
      "type": "DM",
      "title": null,
      "avatar": null
    },
    "participants": [
      {
        "id": "participant_id",
        "user_id": "caller_user_id",
        "joined_at": "2026-06-04T10:00:00.000Z",
        "left_at": null,
        "camera": true,
        "microphone": true,
        "is_screen_sharing": false,
        "user": {
          "id": "caller_user_id",
          "name": "Alice",
          "username": "alice",
          "avatar": null
        }
      }
    ],
    "participant_count": 1,
    "self_participant": null
  }
}
```

### 4.3 Start Call

```txt
POST /rtc/conversations/:conversation_id/start
```

Body:

```json
{
  "kind": "VIDEO"
}
```

`kind` can be `VIDEO` or `AUDIO`. Missing হলে default `VIDEO`.

Response:

```json
{
  "success": true,
  "message": "Call started successfully",
  "data": {
    "id": "call_session_id",
    "conversation_id": "conversation_id",
    "kind": "VIDEO",
    "status": "ONGOING",
    "started_by": "caller_user_id",
    "started_at": "2026-06-04T10:00:00.000Z",
    "room_name": "call-abc12345-x9k2m8pq",
    "participants": [],
    "participant_count": 1,
    "self_participant": {},
    "livekit": {
      "token": "jwt_livekit_token",
      "url": "wss://livekit.example.com",
      "room_name": "call-abc12345-x9k2m8pq",
      "audio_only_suggested": false
    },
    "already_active": false
  }
}
```

Frontend rule:
- `/start` response-এর `data.livekit.token` দিয়েই caller LiveKit connect করবে।
- `/start` এর পর সাথে সাথে `/token` call করবে না।
- যদি `already_active: true` আসে, নতুন call তৈরি হয়নি; same active call join/connect করবে।

### 4.4 Join Call

```txt
POST /rtc/conversations/:conversation_id/join
```

Use:
- Receiver accept করলে।
- Active call chip থেকে join করলে।

Response shape `/start` এর মতোই, `data.livekit` থাকবে।

Frontend rule:
- `/join` response-এর `data.livekit.token` দিয়ে LiveKit connect করবে।
- Accept button press করলে first `/join`, then LiveKit connect.

### 4.5 Issue Token

```txt
POST /rtc/conversations/:conversation_id/token
```

Use:
- LiveKit reconnect করতে।
- Existing call আছে কিন্তু local LiveKit room disconnected হয়ে গেছে।
- App/browser network drop থেকে ফিরে এসেছে।

Do not use:
- `/start` এর পরপর।
- `/join` এর পরপর।

Note: এই endpoint participant upsert করে; প্রথমবার participant হিসেবে না থাকলে অন্যদের কাছে `call:participant_joined` যেতে পারে।

### 4.6 Decline

```txt
POST /rtc/conversations/:conversation_id/decline
```

Use:
- Incoming call reject button.

Behavior:
- DM call হলে session end হবে, caller `call:ended` পাবে, call message `MISSED` হবে।
- Group call হলে session চলবে, অন্যরা `call:declined` পাবে।

### 4.7 Leave

```txt
POST /rtc/conversations/:conversation_id/leave
```

Use:
- User নিজের call থেকে বের হবে।

Behavior:
- এখনও অন্য participant থাকলে `call:participant_left` যাবে।
- শেষ participant বের হলে session end হবে, `call:ended` যাবে, call message final হবে।

### 4.8 End For Everyone

```txt
POST /rtc/conversations/:conversation_id/end
```

Use:
- Call force end.

Who can call:
- DM: যেকোন participant.
- Group: call starter বা group ADMIN.

### 4.9 Update Own Media State

```txt
PATCH /rtc/conversations/:conversation_id/participants/me
```

Body:

```json
{
  "camera": false,
  "microphone": true,
  "is_screen_sharing": false
}
```

Use:
- Mic toggle করার পর backend sync.
- Camera toggle করার পর backend sync.
- Screen share start/stop করার পর backend sync.

Other clients `call:participant_updated` event পাবে।

## 5. Socket.IO Contract

Client connect:

```ts
import { io } from "socket.io-client";

const socket = io(`${SOCKET_URL}/ws`, {
  transports: ["websocket"],
  auth: { token: jwtToken },
});
```

Connection events:

```txt
connection:ok
connection:error
```

Call related events client শুধু listen করবে। Call action করতে REST API call করবে; socket emit করে call start/join/end করা যাবে না।

### 5.1 call:incoming

কখন আসে: অন্য user `/start` করলে।

```json
{
  "conversation_id": "conversation_id",
  "call_session_id": "call_session_id",
  "room_name": "call-abc12345-x9k2m8pq",
  "kind": "VIDEO",
  "started_by": "caller_user_id",
  "started_at": "2026-06-04T10:00:00.000Z",
  "at": "2026-06-04T10:00:00.000Z",
  "conversation_type": "DM",
  "conversation_title": null,
  "caller": {
    "id": "caller_user_id",
    "name": "Alice",
    "username": "alice",
    "avatar": null
  }
}
```

Client action:
- Incoming modal/banner show.
- Ring sound start.
- Accept press করলে `POST /join`.
- Decline press করলে `POST /decline`.
- Timeout হলে frontend নিজে `POST /decline` বা UI hide করতে পারে; backend currently automatic timeout scheduler করে না।

### 5.2 call:participant_joined

কখন আসে: অন্য user first time `/join` বা `/token` দিয়ে participant হিসেবে active হলে।

```json
{
  "conversation_id": "conversation_id",
  "call_session_id": "call_session_id",
  "user": {
    "id": "user_id",
    "name": "Bob",
    "username": "bob",
    "avatar": null
  },
  "participant": {
    "id": "participant_id",
    "user_id": "user_id",
    "joined_at": "2026-06-04T10:01:00.000Z",
    "left_at": null,
    "camera": true,
    "microphone": true,
    "is_screen_sharing": false,
    "user": {}
  },
  "participant_count": 2,
  "joined_at": "2026-06-04T10:01:00.000Z"
}
```

Client action:
- Participant list update.
- If caller waiting UI দেখাচ্ছে, "connected" state show.

### 5.3 call:participant_left

```json
{
  "conversation_id": "conversation_id",
  "call_session_id": "call_session_id",
  "user_id": "user_id",
  "left_at": "2026-06-04T10:05:00.000Z",
  "participant_count": 1
}
```

Client action:
- Participant remove.
- UI participant count update.

### 5.4 call:participant_updated

```json
{
  "conversation_id": "conversation_id",
  "call_session_id": "call_session_id",
  "participant": {
    "id": "participant_id",
    "user_id": "user_id",
    "camera": false,
    "microphone": true,
    "is_screen_sharing": false,
    "user": {}
  }
}
```

Client action:
- Mic/camera/screen share icon update.

### 5.5 call:declined

Group call only.

```json
{
  "conversation_id": "conversation_id",
  "call_session_id": "call_session_id",
  "user_id": "user_id",
  "at": "2026-06-04T10:00:30.000Z"
}
```

Client action:
- Group call UI-তে participant declined text দেখাতে পারো।

### 5.6 call:ended

```json
{
  "conversation_id": "conversation_id",
  "call_session_id": "call_session_id",
  "by_user_id": "user_id",
  "reason": "ended",
  "at": "2026-06-04T10:10:00.000Z"
}
```

`reason`: `ended`, `declined`, `empty_room`.

Client action:
- Incoming modal hide.
- Ring sound stop.
- LiveKit room disconnect.
- Active call state clear.
- Call overlay close.

### 5.7 message:new for CALL

Call start হলেই backend chat timeline-এ `CALL` message create করে এবং `message:new` event দেয়।

```json
{
  "id": "message_id",
  "conversation_id": "conversation_id",
  "kind": "CALL",
  "call_session_id": "call_session_id",
  "content": {
    "call_kind": "VIDEO",
    "status": "ONGOING",
    "duration_seconds": null,
    "reason": null
  },
  "status": "SENT",
  "attachments": [],
  "reply_to": null,
  "sender": {
    "id": "caller_user_id",
    "name": "Alice",
    "avatar": null
  },
  "created_at": "2026-06-04T10:00:00.000Z"
}
```

Client action:
- Normal message list-এ call bubble/card render.
- `content.status === "ONGOING"` হলে "Video call cholche" বা "Audio call cholche" দেখাও।

### 5.8 call:message_updated

Call final হলে existing `CALL` message update হয়।

```json
{
  "conversation_id": "conversation_id",
  "message": {
    "id": "message_id",
    "conversation_id": "conversation_id",
    "kind": "CALL",
    "call_session_id": "call_session_id",
    "content": {
      "call_kind": "VIDEO",
      "status": "ENDED",
      "duration_seconds": 125,
      "reason": "ended"
    },
    "sender": {}
  }
}
```

Client action:
- Message list-এ `message.id` দিয়ে find করে replace/upsert.
- `MISSED` হলে missed call card.
- `ENDED` হলে duration সহ ended call card.

## 6. Exact Call Flow

### 6.1 Caller starts video call

1. User conversation screen open করে।
2. Socket connected কিনা নিশ্চিত করো।
3. User video call button click করে।
4. Frontend calls:

```txt
POST /rtc/conversations/:conversation_id/start
body: { "kind": "VIDEO" }
```

5. Backend creates/returns active call session.
6. Backend immediately creates `CALL` message with `ONGOING`.
7. Backend emits `call:incoming` to other members.
8. Caller uses `response.data.livekit.url` and `response.data.livekit.token` to connect LiveKit.
9. Caller local mic/camera enable করে।
10. Caller UI active call overlay দেখায়।

### 6.2 Receiver accepts

1. Receiver socket gets `call:incoming`.
2. UI incoming banner/modal shows.
3. User accepts.
4. Frontend calls:

```txt
POST /rtc/conversations/:conversation_id/join
```

5. Response থেকে LiveKit token নিয়ে connect.
6. Backend emits `call:participant_joined` to other members.
7. Receiver local mic/camera enable করে।

### 6.3 Receiver browser/app closed ছিল

Socket event missed হবে। তাই:

1. App/browser open হলে socket connect করো।
2. Conversation list বা chat screen load হলে active conversationগুলোর জন্য `GET /rtc/conversations/:id/state` call করো।
3. যদি `data.status === "ONGOING"` এবং current user এখনও LiveKit room-এ না থাকে:
   - Conversation screen-এ active call chip দেখাও।
   - চাইলে incoming/ringing UI দেখাও যদি `data.started_by !== currentUserId`।
4. User join করলে `/join` call করবে।

### 6.4 Decline

1. Incoming UI-তে Decline press.
2. Frontend:

```txt
POST /rtc/conversations/:conversation_id/decline
```

3. DM হলে backend `call:ended` পাঠাবে এবং call message `MISSED` করবে।
4. Group হলে backend `call:declined` পাঠাবে; call চলবে।

### 6.5 Leave or end

Normal leave:

```txt
POST /rtc/conversations/:conversation_id/leave
```

End for everyone:

```txt
POST /rtc/conversations/:conversation_id/end
```

Then:
- LiveKit `room.disconnect()` call করো।
- Local tracks detach/stop করো if SDK handles না করে।
- Active call UI clear করো।

## 7. Next.js Implementation

এই section-টা App Router বা Pages Router দুই জায়গাতেই ব্যবহার করা যাবে। Browser-only hook/component-এ `"use client"` লাগবে।

### 7.1 API helper

Create `src/lib/rtcApi.ts`:

```ts
export type CallKind = "AUDIO" | "VIDEO";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

function authHeaders(token: string, json = true) {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(token, !!options.body),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json();
}

export function getCallState(conversationId: string, token: string) {
  return request<any>(`/rtc/conversations/${conversationId}/state`, token, {
    method: "GET",
  });
}

export function startCall(conversationId: string, token: string, kind: CallKind) {
  return request<any>(`/rtc/conversations/${conversationId}/start`, token, {
    method: "POST",
    body: JSON.stringify({ kind }),
  });
}

export function joinCall(conversationId: string, token: string) {
  return request<any>(`/rtc/conversations/${conversationId}/join`, token, {
    method: "POST",
  });
}

export function declineCall(conversationId: string, token: string) {
  return request<any>(`/rtc/conversations/${conversationId}/decline`, token, {
    method: "POST",
  });
}

export function leaveCall(conversationId: string, token: string) {
  return request<any>(`/rtc/conversations/${conversationId}/leave`, token, {
    method: "POST",
  });
}

export function endCall(conversationId: string, token: string) {
  return request<any>(`/rtc/conversations/${conversationId}/end`, token, {
    method: "POST",
  });
}

export function updateMyMediaState(
  conversationId: string,
  token: string,
  body: { camera?: boolean; microphone?: boolean; is_screen_sharing?: boolean },
) {
  return request<any>(`/rtc/conversations/${conversationId}/participants/me`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
```

### 7.2 Socket hook

Create `src/hooks/useChatSocket.ts`:

```ts
"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL!;

type Handlers = {
  onIncomingCall?: (data: any) => void;
  onCallEnded?: (data: any) => void;
  onParticipantJoined?: (data: any) => void;
  onParticipantLeft?: (data: any) => void;
  onParticipantUpdated?: (data: any) => void;
  onCallDeclined?: (data: any) => void;
  onMessageNew?: (message: any) => void;
  onCallMessageUpdated?: (data: any) => void;
  onConnected?: () => void;
};

export function useChatSocket(token: string | null, handlers: Handlers) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(`${SOCKET_URL}/ws`, {
      transports: ["websocket"],
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connection:ok", () => handlers.onConnected?.());
    socket.on("call:incoming", (d) => handlers.onIncomingCall?.(d));
    socket.on("call:ended", (d) => handlers.onCallEnded?.(d));
    socket.on("call:participant_joined", (d) => handlers.onParticipantJoined?.(d));
    socket.on("call:participant_left", (d) => handlers.onParticipantLeft?.(d));
    socket.on("call:participant_updated", (d) => handlers.onParticipantUpdated?.(d));
    socket.on("call:declined", (d) => handlers.onCallDeclined?.(d));
    socket.on("message:new", (m) => handlers.onMessageNew?.(m));
    socket.on("call:message_updated", (d) => handlers.onCallMessageUpdated?.(d));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return socketRef;
}
```

### 7.3 LiveKit hook

Create `src/hooks/useLiveKitCall.ts`:

```ts
"use client";

import { useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { updateMyMediaState } from "@/lib/rtcApi";

export function useLiveKitCall(token: string) {
  const roomRef = useRef<Room | null>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [remoteTracks, setRemoteTracks] = useState<any[]>([]);

  async function connect(callData: any, localVideoEl?: HTMLVideoElement | null) {
    if (roomRef.current) {
      roomRef.current.disconnect();
    }

    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      setRemoteTracks((prev) => [
        ...prev,
        { sid: track.sid, track, participantIdentity: participant.identity },
      ]);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      setRemoteTracks((prev) => prev.filter((item) => item.sid !== track.sid));
    });

    room.on(RoomEvent.Disconnected, () => {
      setRemoteTracks([]);
    });

    await room.connect(callData.livekit.url, callData.livekit.token);
    await room.localParticipant.setMicrophoneEnabled(true);

    if (callData.kind === "VIDEO") {
      await room.localParticipant.setCameraEnabled(true);
      const videoPub = Array.from(room.localParticipant.videoTrackPublications.values())[0];
      if (videoPub?.track && localVideoEl) {
        videoPub.track.attach(localVideoEl);
      }
    }

    setActiveCall(callData);
  }

  async function toggleMic() {
    const room = roomRef.current;
    if (!room || !activeCall) return;
    const current = activeCall.self_participant?.microphone !== false;
    const next = !current;
    await room.localParticipant.setMicrophoneEnabled(next);
    const res = await updateMyMediaState(activeCall.conversation_id, token, {
      microphone: next,
    });
    setActiveCall((prev: any) => ({
      ...prev,
      self_participant: res.data.participant,
    }));
  }

  async function toggleCamera(localVideoEl?: HTMLVideoElement | null) {
    const room = roomRef.current;
    if (!room || !activeCall) return;
    const current = activeCall.self_participant?.camera !== false;
    const next = !current;
    await room.localParticipant.setCameraEnabled(next);
    if (next && localVideoEl) {
      const videoPub = Array.from(room.localParticipant.videoTrackPublications.values())[0];
      if (videoPub?.track?.kind === Track.Kind.Video) {
        videoPub.track.attach(localVideoEl);
      }
    }
    const res = await updateMyMediaState(activeCall.conversation_id, token, {
      camera: next,
    });
    setActiveCall((prev: any) => ({
      ...prev,
      self_participant: res.data.participant,
    }));
  }

  async function disconnect() {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setRemoteTracks([]);
    setActiveCall(null);
  }

  return {
    roomRef,
    activeCall,
    setActiveCall,
    remoteTracks,
    connect,
    toggleMic,
    toggleCamera,
    disconnect,
  };
}
```

### 7.4 Call UI component example

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  declineCall,
  endCall,
  getCallState,
  joinCall,
  leaveCall,
  startCall,
} from "@/lib/rtcApi";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useLiveKitCall } from "@/hooks/useLiveKitCall";

export function ChatCallController({
  token,
  currentUserId,
  conversationId,
}: {
  token: string;
  currentUserId: string;
  conversationId: string;
}) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [incoming, setIncoming] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const call = useLiveKitCall(token);

  async function syncActiveCall(openAsIncoming = false) {
    const res = await getCallState(conversationId, token);
    const active = res.data;

    if (!active) {
      setIncoming(null);
      call.setActiveCall(null);
      return;
    }

    call.setActiveCall(active);

    if (openAsIncoming && active.started_by !== currentUserId && !call.roomRef.current) {
      setIncoming({
        conversation_id: active.conversation_id,
        call_session_id: active.id,
        kind: active.kind,
        started_by: active.started_by,
        started_at: active.started_at,
      });
    }
  }

  useChatSocket(token, {
    onConnected: () => {
      syncActiveCall(true);
    },
    onIncomingCall: (data) => {
      if (data.conversation_id === conversationId) setIncoming(data);
    },
    onCallEnded: (data) => {
      if (data.conversation_id !== conversationId) return;
      setIncoming(null);
      call.disconnect();
    },
    onParticipantJoined: (data) => {
      if (data.conversation_id === conversationId) syncActiveCall(false);
    },
    onParticipantLeft: (data) => {
      if (data.conversation_id === conversationId) syncActiveCall(false);
    },
    onParticipantUpdated: (data) => {
      if (data.conversation_id === conversationId) syncActiveCall(false);
    },
    onMessageNew: (message) => {
      setMessages((prev) => [message, ...prev]);
    },
    onCallMessageUpdated: ({ message }) => {
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === message.id);
        if (index === -1) return [message, ...prev];
        const next = [...prev];
        next[index] = message;
        return next;
      });
    },
  });

  useEffect(() => {
    syncActiveCall(true);
  }, [conversationId]);

  async function handleStart(kind: "AUDIO" | "VIDEO") {
    const res = await startCall(conversationId, token, kind);
    await call.connect(res.data, localVideoRef.current);
  }

  async function handleAccept() {
    if (!incoming) return;
    setIncoming(null);
    const res = await joinCall(incoming.conversation_id, token);
    await call.connect(res.data, localVideoRef.current);
  }

  async function handleDecline() {
    if (!incoming) return;
    await declineCall(incoming.conversation_id, token);
    setIncoming(null);
  }

  async function handleLeave() {
    if (!call.activeCall) return;
    await leaveCall(call.activeCall.conversation_id, token);
    await call.disconnect();
  }

  async function handleEndForEveryone() {
    if (!call.activeCall) return;
    await endCall(call.activeCall.conversation_id, token);
    await call.disconnect();
  }

  return (
    <div>
      <button onClick={() => handleStart("AUDIO")}>Audio Call</button>
      <button onClick={() => handleStart("VIDEO")}>Video Call</button>

      {incoming && (
        <div>
          <p>{incoming.kind} call incoming</p>
          <button onClick={handleAccept}>Accept</button>
          <button onClick={handleDecline}>Decline</button>
        </div>
      )}

      {call.activeCall && (
        <div>
          <p>Active {call.activeCall.kind} call</p>
          <video ref={localVideoRef} autoPlay playsInline muted />
          <button onClick={() => call.toggleMic()}>Mic</button>
          <button onClick={() => call.toggleCamera(localVideoRef.current)}>Camera</button>
          <button onClick={handleLeave}>Leave</button>
          <button onClick={handleEndForEveryone}>End</button>
        </div>
      )}
    </div>
  );
}
```

### 7.5 Next.js step order

1. Login করে JWT save করো।
2. Chat layout mount হলে socket connect করো।
3. `connection:ok` পেলে selected/open conversations-এর call state fetch করো।
4. Conversation open করলে `GET /state` call করো।
5. User call button press করলে `/start`, then LiveKit connect.
6. `call:incoming` পেলে incoming UI show.
7. Accept করলে `/join`, then LiveKit connect.
8. Decline করলে `/decline`.
9. Mic/camera toggle করলে first LiveKit local track update, then `PATCH /participants/me`.
10. Leave করলে `/leave`, then `room.disconnect()`.
11. `call:ended` পেলে always disconnect and clear UI.
12. `message:new` and `call:message_updated` দিয়ে call message bubble update করো।

## 8. Flutter Implementation

### 8.1 RTC API service

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class RtcApi {
  RtcApi(this.baseUrl, this.token);

  final String baseUrl; // https://api.example.com/api
  final String token;

  Map<String, String> get headers => {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };

  Future<Map<String, dynamic>> _request(
    String path, {
    String method = 'POST',
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    late http.Response res;

    if (method == 'GET') {
      res = await http.get(uri, headers: headers);
    } else if (method == 'PATCH') {
      res = await http.patch(uri, headers: headers, body: jsonEncode(body ?? {}));
    } else {
      res = await http.post(uri, headers: headers, body: body == null ? null : jsonEncode(body));
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(res.body);
    }

    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getState(String conversationId) {
    return _request('/rtc/conversations/$conversationId/state', method: 'GET');
  }

  Future<Map<String, dynamic>> start(String conversationId, String kind) {
    return _request('/rtc/conversations/$conversationId/start', body: {'kind': kind});
  }

  Future<Map<String, dynamic>> join(String conversationId) {
    return _request('/rtc/conversations/$conversationId/join');
  }

  Future<Map<String, dynamic>> decline(String conversationId) {
    return _request('/rtc/conversations/$conversationId/decline');
  }

  Future<Map<String, dynamic>> leave(String conversationId) {
    return _request('/rtc/conversations/$conversationId/leave');
  }

  Future<Map<String, dynamic>> end(String conversationId) {
    return _request('/rtc/conversations/$conversationId/end');
  }

  Future<Map<String, dynamic>> updateMedia(
    String conversationId, {
    bool? camera,
    bool? microphone,
    bool? isScreenSharing,
  }) {
    return _request(
      '/rtc/conversations/$conversationId/participants/me',
      method: 'PATCH',
      body: {
        if (camera != null) 'camera': camera,
        if (microphone != null) 'microphone': microphone,
        if (isScreenSharing != null) 'is_screen_sharing': isScreenSharing,
      },
    );
  }
}
```

### 8.2 Socket service

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class ChatSocket {
  ChatSocket(this.socketUrl, this.token);

  final String socketUrl; // https://api.example.com
  final String token;
  IO.Socket? socket;

  void connect({
    void Function()? onConnected,
    void Function(dynamic data)? onIncomingCall,
    void Function(dynamic data)? onCallEnded,
    void Function(dynamic data)? onParticipantJoined,
    void Function(dynamic data)? onParticipantLeft,
    void Function(dynamic data)? onParticipantUpdated,
    void Function(dynamic data)? onCallDeclined,
    void Function(dynamic message)? onMessageNew,
    void Function(dynamic data)? onCallMessageUpdated,
  }) {
    socket = IO.io(
      '$socketUrl/ws',
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );

    socket!.on('connection:ok', (_) => onConnected?.call());
    socket!.on('call:incoming', (data) => onIncomingCall?.call(data));
    socket!.on('call:ended', (data) => onCallEnded?.call(data));
    socket!.on('call:participant_joined', (data) => onParticipantJoined?.call(data));
    socket!.on('call:participant_left', (data) => onParticipantLeft?.call(data));
    socket!.on('call:participant_updated', (data) => onParticipantUpdated?.call(data));
    socket!.on('call:declined', (data) => onCallDeclined?.call(data));
    socket!.on('message:new', (data) => onMessageNew?.call(data));
    socket!.on('call:message_updated', (data) => onCallMessageUpdated?.call(data));

    socket!.connect();
  }

  void dispose() {
    socket?.disconnect();
    socket?.dispose();
  }
}
```

### 8.3 LiveKit call manager

```dart
import 'package:livekit_client/livekit_client.dart';

class CallManager {
  Room? room;
  Map<String, dynamic>? activeCall;

  Future<void> connect(Map<String, dynamic> callData) async {
    await disconnect();

    activeCall = callData;
    final livekit = callData['livekit'] as Map<String, dynamic>;

    room = Room();
    await room!.connect(
      livekit['url'] as String,
      livekit['token'] as String,
    );

    await room!.localParticipant?.setMicrophoneEnabled(true);

    if (callData['kind'] == 'VIDEO') {
      await room!.localParticipant?.setCameraEnabled(true);
    }
  }

  Future<void> toggleMic(RtcApi api) async {
    if (room == null || activeCall == null) return;
    final current = activeCall?['self_participant']?['microphone'] != false;
    final next = !current;

    await room!.localParticipant?.setMicrophoneEnabled(next);
    final res = await api.updateMedia(
      activeCall!['conversation_id'] as String,
      microphone: next,
    );
    activeCall!['self_participant'] = res['data']['participant'];
  }

  Future<void> toggleCamera(RtcApi api) async {
    if (room == null || activeCall == null) return;
    final current = activeCall?['self_participant']?['camera'] != false;
    final next = !current;

    await room!.localParticipant?.setCameraEnabled(next);
    final res = await api.updateMedia(
      activeCall!['conversation_id'] as String,
      camera: next,
    );
    activeCall!['self_participant'] = res['data']['participant'];
  }

  Future<void> disconnect() async {
    await room?.disconnect();
    room?.dispose();
    room = null;
    activeCall = null;
  }
}
```

### 8.4 Flutter screen flow

```dart
class ChatCallController {
  ChatCallController({
    required this.currentUserId,
    required this.conversationId,
    required this.api,
    required this.callManager,
  });

  final String currentUserId;
  final String conversationId;
  final RtcApi api;
  final CallManager callManager;

  Map<String, dynamic>? incomingCall;

  Future<void> syncActiveCall({bool showIncomingIfNeeded = false}) async {
    final res = await api.getState(conversationId);
    final active = res['data'];

    if (active == null) {
      incomingCall = null;
      return;
    }

    callManager.activeCall = Map<String, dynamic>.from(active);

    if (showIncomingIfNeeded &&
        active['started_by'] != currentUserId &&
        callManager.room == null) {
      incomingCall = Map<String, dynamic>.from(active);
    }
  }

  Future<void> startVideoCall() async {
    final res = await api.start(conversationId, 'VIDEO');
    await callManager.connect(Map<String, dynamic>.from(res['data']));
  }

  Future<void> startAudioCall() async {
    final res = await api.start(conversationId, 'AUDIO');
    await callManager.connect(Map<String, dynamic>.from(res['data']));
  }

  Future<void> acceptIncoming() async {
    if (incomingCall == null) return;
    final convId = incomingCall!['conversation_id'] as String;
    incomingCall = null;
    final res = await api.join(convId);
    await callManager.connect(Map<String, dynamic>.from(res['data']));
  }

  Future<void> declineIncoming() async {
    if (incomingCall == null) return;
    final convId = incomingCall!['conversation_id'] as String;
    incomingCall = null;
    await api.decline(convId);
  }

  Future<void> leave() async {
    final convId = callManager.activeCall?['conversation_id'];
    if (convId == null) return;
    await api.leave(convId as String);
    await callManager.disconnect();
  }

  Future<void> endForEveryone() async {
    final convId = callManager.activeCall?['conversation_id'];
    if (convId == null) return;
    await api.end(convId as String);
    await callManager.disconnect();
  }
}
```

Flutter step order:

1. App start/login এর পর socket connect.
2. `connection:ok` পেলে open conversations বা current conversation-এর `/state` call.
3. `call:incoming` পেলে incoming dialog show.
4. Accept করলে `/join`, then LiveKit connect.
5. Decline করলে `/decline`.
6. Call screen open হলে local/remote `VideoTrack` widgets render.
7. Mic/camera toggle করলে LiveKit local participant update, then `PATCH /participants/me`.
8. `call:ended` পেলে `room.disconnect()`, dialog/overlay close.
9. App resume হলে আবার `/state` call করে active call recover.

## 9. Call Message UI

Message renderer-এ `kind === "CALL"` আলাদা handle করো।

```ts
function getCallMessageLabel(message: any) {
  const content = message.content || {};
  const type = content.call_kind === "AUDIO" ? "Audio" : "Video";

  if (content.status === "ONGOING") {
    return `${type} call cholche`;
  }

  if (content.status === "MISSED") {
    return `Missed ${type.toLowerCase()} call`;
  }

  const total = content.duration_seconds || 0;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  const duration = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  return `${type} call ended, ${duration}`;
}
```

Socket update:

```ts
socket.on("message:new", (message) => {
  upsertMessage(message);
});

socket.on("call:message_updated", ({ message }) => {
  upsertMessage(message);
});
```

Important:
- `message:new` creates the call card.
- `call:message_updated` updates same card.
- Upsert must be by `message.id`.

## 10. Edge Cases

| Case | Expected frontend behavior |
| --- | --- |
| Receiver browser/app closed during incoming call | Later open করলে `/state` call করে active call show/ring |
| `call:incoming` missed | `/state` is source of truth |
| User clicks call while another call active in same conversation | `/start` returns `already_active: true`; join/connect same call |
| `/join` returns `No active call found` | Incoming UI close; call already ended |
| DM receiver declines | Caller gets `call:ended`, message becomes `MISSED` |
| Caller starts and nobody joins, caller leaves | Message becomes `MISSED` because only caller participated |
| Participants talked then call ends | Message becomes `ENDED` with `duration_seconds` |
| LiveKit disconnected but backend call still active | Use `/token` or `/join` to reconnect |
| Socket reconnect | Run `/state` again |
| Mic/camera icon wrong | Always sync with `PATCH /participants/me` after LiveKit local toggle |

## 11. Developer Checklist

Next.js:

- `NEXT_PUBLIC_API_URL` includes `/api`.
- `NEXT_PUBLIC_SOCKET_URL` does not include `/api`.
- Socket listens to all call events.
- Conversation open/reconnect calls `/state`.
- Start uses `/start` then LiveKit connect.
- Accept uses `/join` then LiveKit connect.
- Decline uses `/decline`.
- Leave uses `/leave`; force end uses `/end`.
- `call:ended` always disconnects LiveKit.
- `message:new` and `call:message_updated` update call card.

Flutter:

- Android/iOS permissions added.
- Socket connects to `$socketUrl/ws`.
- App resume triggers `/state`.
- Incoming dialog uses `/join` or `/decline`.
- LiveKit room disconnects on `call:ended`.
- Mic/camera state synced to backend.

## 12. Common Mistakes

1. Socket URL-এ `/api/ws` ব্যবহার করা যাবে না। Correct: `https://api.example.com/ws`.
2. `/start` এর পর আবার `/token` call করা যাবে না।
3. `call:incoming` না পেলে call নেই ধরে নেওয়া যাবে না; `/state` check করতে হবে।
4. Socket দিয়ে call start/join/end emit করা যাবে না; এগুলো REST API.
5. `call:message_updated` পেলে নতুন message append না করে same `message.id` replace করতে হবে।
6. LiveKit disconnect করলেই backend session end হয় না; `/leave` বা `/end` call করতে হবে।
7. `/leave` বা `/end` call করলেই local LiveKit auto disconnect হয় না; frontend-কে `room.disconnect()` করতে হবে।

## 13. Minimal Production Flow

```txt
App mount
  -> socket connect
  -> connection:ok
  -> current conversation /state

Start call
  -> POST /start
  -> connect LiveKit with response.data.livekit
  -> show call overlay

Receive call
  -> socket call:incoming
  -> show incoming UI
  -> Accept: POST /join -> connect LiveKit
  -> Decline: POST /decline

Reconnect/open app
  -> socket connect
  -> GET /state
  -> if ONGOING and not in room, show active call/incoming UI

Leave/end
  -> POST /leave or /end
  -> room.disconnect()
  -> clear UI

Call message
  -> message:new renders ONGOING call card
  -> call:message_updated replaces same card with MISSED/ENDED
```
