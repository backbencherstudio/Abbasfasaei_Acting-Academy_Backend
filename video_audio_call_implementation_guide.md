# ভিডিও ও অডিও কল — সম্পূর্ণ Implementation Guide

> **Backend Stack:** NestJS · Prisma · PostgreSQL · Redis · LiveKit · Socket.IO
> **সাথে পড়ুন:** WebSocket সংযোগের বিস্তারিত জানতে [`socket_implementation_guide.md`](./socket_implementation_guide.md) দেখুন।

এই গাইডটি **Web (JavaScript)** এবং **Flutter (Dart)** — উভয় developer-এর জন্য লেখা হয়েছে। প্রতিটি ধাপে দুটো প্ল্যাটফর্মের কোড উদাহরণ আলাদাভাবে দেওয়া আছে।

---

## সূচিপত্র

1. [সিস্টেম আর্কিটেকচার](#১-সিস্টেম-আর্কিটেকচার)
2. [কিভাবে কাজ করে — সংক্ষিপ্ত ধারণা](#২-কিভাবে-কাজ-করে--সংক্ষিপ্ত-ধারণা)
3. [Database Model পরিচিতি](#৩-database-model-পরিচিতি)
4. [REST API রেফারেন্স](#৪-rest-api-রেফারেন্স)
5. [WebSocket Event রেফারেন্স](#৫-websocket-event-রেফারেন্স)
6. [সম্পূর্ণ Call Flow](#৬-সম্পূর্ণ-call-flow)
7. [Web Implementation (JavaScript)](#৭-web-implementation-javascript)
8. [Flutter Implementation (Dart)](#৮-flutter-implementation-dart)
9. [Media State Sync](#৯-media-state-sync)
10. **[Call Message — Chat Timeline-এ কল দেখানো](#১০-call-message--chat-timeline-এ-কল-দেখানো)**
11. [Edge Cases ও গুরুত্বপূর্ণ নিয়ম](#১১-edge-cases-ও-গুরুত্বপূর্ণ-নিয়ম)
12. [সাধারণ সমস্যা ও সমাধান](#১২-সাধারণ-সমস্যা-ও-সমাধান)

---

## ১. সিস্টেম আর্কিটেকচার

```
Client A (Web/Flutter)      Backend (NestJS)         Client B (Web/Flutter)
        │                         │                          │
        │── POST /rtc/.../start ──►                          │
        │◄── { livekit: {         │                          │
        │      token, url } }     │── WS: call:incoming ────►│
        │                         │                          │
        │◄══════════ LiveKit Room (WebRTC SFU) ═════════════►│
        │              (আসল Audio/Video যায় এখান দিয়ে)      │
        │                         │                          │
        │── POST /rtc/.../leave ──►                          │
        │                         │── WS: call:ended ───────►│
```

### তিনটি আলাদা স্তর

| স্তর | কাজ | প্রযুক্তি |
|------|-----|-----------|
| **Signaling** | Call শুরু, join, leave, decline করা | HTTP REST API |
| **Notification** | Incoming call, participant changes জানানো | WebSocket (Socket.IO) |
| **Media Transport** | আসল Audio/Video ট্র্যাক পাঠানো | LiveKit (WebRTC SFU) |

**গুরুত্বপূর্ণ:** Audio/Video ডেটা সরাসরি Backend দিয়ে যায় না — LiveKit server দিয়ে যায়।

---

## ২. কিভাবে কাজ করে — সংক্ষিপ্ত ধারণা

### ধাপে ধাপে:

1. **Alice** `POST /start` করে → Backend একটি `CallSession` তৈরি করে এবং LiveKit token দেয়
2. **Alice** সেই token দিয়ে LiveKit-এ সরাসরি connect করে
3. **Backend** অন্য members-কে WebSocket দিয়ে `call:incoming` event পাঠায়
4. **Bob** Incoming call notification পেলে `POST /join` করে → নতুন token পায়
5. **Bob** সেই token দিয়ে একই LiveKit room-এ connect করে
6. **LiveKit** দুজনের মধ্যে Audio/Video stream চালু করে
7. যে কেউ `POST /leave` করলে — সবাই চলে গেলে call শেষ হয়

---

## ৩. Database Model পরিচিতি

### `CallSession` — কলের মূল রেকর্ড

| Field | Type | ব্যাখ্যা |
|-------|------|---------|
| `id` | String | Primary key |
| `conversation_id` | String | কোন conversation-এর call |
| `kind` | `AUDIO` / `VIDEO` | কলের ধরন |
| `status` | `ONGOING` / `ENDED` / `MISSED` | কলের অবস্থা |
| `started_by` | String | কে শুরু করেছে (user_id) |
| `started_at` | DateTime | কখন শুরু হয়েছে |
| `ended_at` | DateTime? | কখন শেষ হয়েছে (চলমান হলে null) |
| `room_name` | String? | LiveKit room name — **তৈরির সময় একবার সেভ হয়, আর বদলায় না** |

### `CallParticipant` — প্রতিটি অংশগ্রহণকারীর রেকর্ড

| Field | Type | ব্যাখ্যা |
|-------|------|---------|
| `call_id` | String | কোন CallSession-এর |
| `user_id` | String | কোন user |
| `joined_at` | DateTime | কখন join করেছে |
| `left_at` | DateTime? | কখন চলে গেছে (এখনও আছে হলে null) |
| `camera` | Boolean | ক্যামেরা চালু কিনা |
| `microphone` | Boolean | মাইক চালু কিনা |
| `is_screen_sharing` | Boolean | স্ক্রিন শেয়ার চলছে কিনা |

---

## ৪. REST API রেফারেন্স

সব endpoint-এ Header-এ JWT Token দিতে হবে:
```
Authorization: Bearer <your_jwt_token>
```

---

### `GET /api/rtc/health`
LiveKit configuration ঠিক আছে কিনা চেক করুন।

```json
// Response (সব ঠিক থাকলে)
{
  "ok": true,
  "error": null,
  "url": "wss://your-livekit-server.com",
  "api_key_present": true,
  "token_ttl_seconds": 600
}
```

---

### `GET /api/rtc/conversations/:conversation_id/state`
কোনো conversation-এ এখন call চলছে কিনা জানুন।

```json
// কল নেই
{ "success": true, "message": "No active call found", "data": null }

// কল চলছে
{
  "success": true,
  "data": {
    "id": "session_id",
    "kind": "VIDEO",
    "status": "ONGOING",
    "started_by": "user_abc",
    "started_at": "2026-01-01T10:00:00.000Z",
    "room_name": "call-abc12345-x9k2m8pq",
    "conversation": {
      "id": "conv_id",
      "type": "DM",
      "title": null,
      "avatar": null
    },
    "participants": [
      {
        "id": "participant_id",
        "user_id": "user_abc",
        "joined_at": "2026-01-01T10:00:00.000Z",
        "left_at": null,
        "camera": true,
        "microphone": true,
        "is_screen_sharing": false,
        "user": {
          "id": "user_abc",
          "name": "Alice",
          "username": "alice",
          "avatar": "https://..."
        }
      }
    ],
    "participant_count": 1,
    "self_participant": { ... }
  }
}
```

---

### `POST /api/rtc/conversations/:conversation_id/start`
নতুন কল শুরু করুন।

**Request Body:**
```json
{ "kind": "VIDEO" }
// অথবা: { "kind": "AUDIO" }
// kind না দিলে default VIDEO হবে
```

**Response:**
```json
{
  "success": true,
  "message": "Call started successfully",
  "data": {
    "id": "session_id",
    "kind": "VIDEO",
    "room_name": "call-abc12345-x9k2m8pq",
    "livekit": {
      "token": "eyJhbGci...",
      "url": "wss://your-livekit.com",
      "room_name": "call-abc12345-x9k2m8pq",
      "audio_only_suggested": false
    },
    "already_active": false
  }
}
```

> **⚠️ গুরুত্বপূর্ণ:** `/start` এর response-এ `data.livekit.token` আসে — এটাই সরাসরি LiveKit connect করতে ব্যবহার করুন। **এর পরে আর `/token` call করবেন না** — তাহলে অযথা দুটো token তৈরি হবে।

---

### `POST /api/rtc/conversations/:conversation_id/join`
চলমান কলে যোগ দিন (caller ছাড়া বাকিরা এটা করবে)।

**Response:** `/start` এর মতোই — `data.livekit.token` থাকবে।

---

### `POST /api/rtc/conversations/:conversation_id/token`
নতুন LiveKit token নিন।

**শুধুমাত্র এই ক্ষেত্রে ব্যবহার করুন:**
- Token মেয়াদ শেষ হওয়ার আগে refresh করতে (TTL = ১০ মিনিট)
- Network drop-এর পর reconnect করতে
- App background থেকে ফিরে আসলে

> **❌ ভুল:** `/start` বা `/join` এর পরপরই `/token` call করবেন না।

---

### `POST /api/rtc/conversations/:conversation_id/decline`
ইনকামিং কল রিজেক্ট করুন।

| Conversation Type | কী হবে |
|---|---|
| **DM** | Session শেষ হয়ে যাবে। Caller `call:ended` পাবে (reason: `"declined"`) |
| **Group** | Session চলতে থাকবে, অন্যরা answer করতে পারবে। `call:declined` event যাবে |

---

### `POST /api/rtc/conversations/:conversation_id/leave`
কল থেকে বের হন।

- সবাই চলে গেলে (`remaining = 0`) → Session শেষ হয়, সবাই `call:ended` পাবে
- DM এবং Group উভয় ক্ষেত্রে একই নিয়ম

---

### `POST /api/rtc/conversations/:conversation_id/end`
সবার জন্য কল জোর করে শেষ করুন।

**কে করতে পারবে:**
- DM-এ যেকোনো একজন participant
- Group-এ call initiator (যে শুরু করেছে)
- Group-এ ADMIN role-এর user

---

### `PATCH /api/rtc/conversations/:conversation_id/participants/me`
নিজের camera/mic/screen share status update করুন।

**Request Body (যেকোনো একটা দিলেই হবে):**
```json
{
  "camera": false,
  "microphone": true,
  "is_screen_sharing": false
}
```

---

## ৫. WebSocket Event রেফারেন্স

WebSocket কিভাবে connect করবেন সেটা `socket_implementation_guide.md`-এ আছে।
কল-সম্পর্কিত সব event **client শুধু receive করে** — পাঠায় না।

---

### `call:incoming` — ইনকামিং কল notification

```json
{
  "conversation_id": "conv_abc",
  "call_session_id": "session_xyz",
  "room_name": "call-abc12345-x9k2m8pq",
  "kind": "VIDEO",
  "started_by": "user_alice",
  "started_at": "2026-01-01T10:00:00.000Z",
  "at": "2026-01-01T10:00:00.000Z",
  "conversation_type": "DM",
  "conversation_title": null,
  "caller": {
    "id": "user_alice",
    "name": "Alice",
    "username": "alice",
    "avatar": "https://..."
  }
}
```

**কখন আসে:** অন্য কেউ `POST /start` করলে।

---

### `call:participant_joined` — কেউ join করেছে

```json
{
  "conversation_id": "conv_abc",
  "call_session_id": "session_xyz",
  "user": {
    "id": "user_bob",
    "name": "Bob",
    "username": "bob",
    "avatar": "https://..."
  },
  "participant": {
    "id": "participant_id",
    "user_id": "user_bob",
    "joined_at": "2026-01-01T10:01:00.000Z",
    "camera": true,
    "microphone": true,
    "is_screen_sharing": false,
    "user": { ... }
  },
  "participant_count": 2,
  "joined_at": "2026-01-01T10:01:00.000Z"
}
```

**কখন আসে:** অন্য কেউ `POST /join` বা `POST /token` করলে (প্রথমবার join)।

---

### `call:participant_left` — কেউ বের হয়ে গেছে (কিন্তু call চলছে)

```json
{
  "conversation_id": "conv_abc",
  "call_session_id": "session_xyz",
  "user_id": "user_carol",
  "left_at": "2026-01-01T10:15:00.000Z",
  "participant_count": 1
}
```

**কখন আসে:** কেউ `POST /leave` করলে এবং call এখনও চলছে।

---

### `call:participant_updated` — কেউ camera/mic বদলেছে

```json
{
  "conversation_id": "conv_abc",
  "call_session_id": "session_xyz",
  "participant": {
    "id": "participant_id",
    "user_id": "user_bob",
    "camera": false,
    "microphone": true,
    "is_screen_sharing": true,
    "user": { ... }
  }
}
```

**কখন আসে:** কেউ `PATCH /participants/me` করলে।

---

### `call:declined` — কেউ কল রিজেক্ট করেছে (শুধু Group call)

```json
{
  "conversation_id": "conv_abc",
  "call_session_id": "session_xyz",
  "user_id": "user_carol",
  "at": "2026-01-01T10:00:30.000Z"
}
```

**কখন আসে:** Group call-এ কেউ `POST /decline` করলে।

---

### `call:ended` — কল শেষ হয়ে গেছে

```json
{
  "conversation_id": "conv_abc",
  "call_session_id": "session_xyz",
  "by_user_id": "user_alice",
  "reason": "ended",
  "at": "2026-01-01T10:30:00.000Z"
}
```

**`reason` এর মান:**

| `reason` | কখন আসে |
|----------|---------|
| `"ended"` | `POST /end` দিয়ে জোর করে শেষ করা হয়েছে |
| `"empty_room"` | শেষ participant `POST /leave` করেছে |
| `"declined"` | DM call decline করা হয়েছে |

> **⚠️ গুরুত্বপূর্ণ:** এই event আসলে সাথে সাথে LiveKit room disconnect করুন এবং call UI সরিয়ে ফেলুন।

---

## ৬. সম্পূর্ণ Call Flow

### ৬.১ DM (১:১) Call Flow

```
Alice                        Backend                       Bob
  │                             │                            │
  │── POST /start (kind=VIDEO) ─►                            │
  │◄── { livekit: {token,url} } │                            │
  │                             │──── WS: call:incoming ────►│
  │                             │                            │
  │ LiveKit.connect(url, token) │              [Bob Accept করে]
  │                             │◄── POST /join ─────────────│
  │                             │──── { livekit:{token} } ──►│
  │◄── WS: call:participant_joined                            │
  │                             │  Bob LiveKit.connect()     │
  │◄══════ Audio/Video Stream (LiveKit) ═══════════════════►│
  │                             │                            │
  │── POST /leave ─────────────►│                            │
  │                             │  remaining = 0 → end       │
  │◄── WS: call:ended ──────────────────────────────────────►│
```

**DM নিয়ম:** শেষ participant বের হলেই call শেষ। কেউ decline করলে তৎক্ষণাৎ session শেষ।

---

### ৬.২ Group Call Flow

```
Alice (caller)              Backend           Bob          Carol
  │                            │               │              │
  │── POST /start ─────────────►               │              │
  │◄── { livekit:{token} } ────│               │              │
  │                            │── call:incoming ─────────────►│
  │                            │── call:incoming ─────────────►│
  │                            │               │              │
  │                            │◄── POST /join │              │
  │◄── call:participant_joined ─               │              │
  │                            │◄── POST /join ───────────────│
  │◄── call:participant_joined ─               │              │
  │                ◄───────────────────────────│              │
  │                            │               │              │
  │── POST /end ───────────────►  (force end)  │              │
  │◄── call:ended ─────────────│               │              │
  │                            │── call:ended ─►              │
  │                            │── call:ended ──────────────► │
```

**Group নিয়ম:**
- যেকোনো member স্বাধীনভাবে leave করতে পারবে
- শুধু **initiator** বা **ADMIN** `POST /end` করতে পারবে
- শেষ member চলে গেলে automatic end
- Decline করলে শুধু `call:declined` যায়, session চলে

---

### ৬.৩ Decline Flow

**DM Decline:**
```
Bob                          Backend                      Alice
  │── POST /decline ───────────►                             │
  │                            │ Session → ENDED             │
  │                            │── WS: call:ended ──────────►│
  │◄── { success: true } ──────│   reason: "declined"        │
```

**Group Decline:**
```
Carol                        Backend              Alice         Bob
  │── POST /decline ───────────►                    │             │
  │                            │ Session → ONGOING  │             │
  │                            │── call:declined ──►│             │
  │                            │── call:declined ───────────────► │
  │◄── { success: true } ──────│                    │             │
```

---

### ৬.৪ Reconnect / Token Refresh

LiveKit token **১০ মিনিট** পরে expire হয়।

```
Client                       Backend
  │── POST /token ─────────────►  (join করবেন না, শুধু token নিন)
  │◄── { livekit:{token,url} } │
  │  LiveKit.connect(url, token) — reconnect
```

- আগে থেকেই active participant → `already_joined: true`, **`call:participant_joined` আসবে না**
- Absent ছিলেন (app kill হয়েছিল) → নতুন participant record, **`call:participant_joined` আসবে**

---

## ৭. Web Implementation (JavaScript)

LiveKit JavaScript SDK ইনস্টল করুন:
```html
<!-- CDN -->
<script src="https://unpkg.com/livekit-client/dist/livekit-client.umd.min.js"></script>
```
অথবা npm:
```bash
npm install livekit-client
```

---

### ৭.১ Helper Functions

```javascript
// Auth header তৈরি করুন
function authHeaders() {
  const token = localStorage.getItem('access_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// API base URL
const API_BASE = 'http://your-server.com/api';

// Global state
let lkRoom = null;
let currentCallKind = 'VIDEO';
let currentConversationId = null;
let pendingIncomingCall = null;
let micEnabled = true;
let camEnabled = true;
```

---

### ৭.২ কল শুরু করা (Correct Pattern)

```javascript
// ✅ সঠিক পদ্ধতি: /start থেকে পাওয়া token সরাসরি ব্যবহার করুন
async function startCall(conversationId, kind = 'VIDEO') {
  currentConversationId = conversationId;
  currentCallKind = kind;

  try {
    showCallOverlay(`${kind} call শুরু হচ্ছে...`);

    const resp = await fetch(
      `${API_BASE}/rtc/conversations/${conversationId}/start`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ kind }),
      }
    );

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.message || 'Call শুরু করা যায়নি');
    }

    const { data } = await resp.json();

    // data.livekit.token সরাসরি connect করুন
    await connectToLiveKit(data.livekit.url, data.livekit.token, kind);

  } catch (error) {
    console.error('startCall failed:', error);
    showError(error.message);
    hideCallOverlay();
  }
}

// ❌ ভুল পদ্ধতি: /start এর পরে /token call করবেন না
async function startCallWrong(conversationId, kind) {
  await fetch(`.../start`, { method: 'POST', ... }); // token ফেলে দেওয়া হলো
  const { data } = await fetch(`.../token`, { method: 'POST' }); // অতিরিক্ত কাজ
  await connectToLiveKit(data.livekit.url, data.livekit.token);
}
```

---

### ৭.৩ ইনকামিং কল Handle করা

```javascript
// WebSocket থেকে ইনকামিং কল listen করুন
socket.on('call:incoming', (call) => {
  pendingIncomingCall = call;
  showIncomingCallBanner({
    callerName: call.caller?.name || 'Unknown',
    kind: call.kind,
    conversationTitle: call.conversation_title,
  });
});

// কল Accept করুন
async function acceptCall() {
  const call = pendingIncomingCall;
  if (!call) return;

  hideIncomingCallBanner();
  currentConversationId = call.conversation_id;
  currentCallKind = call.kind;

  try {
    showCallOverlay(`${call.kind} call-এ যোগ দেওয়া হচ্ছে...`);

    const resp = await fetch(
      `${API_BASE}/rtc/conversations/${call.conversation_id}/join`,
      {
        method: 'POST',
        headers: authHeaders(),
      }
    );

    if (!resp.ok) throw new Error('Join করা যায়নি');

    const { data } = await resp.json();
    await connectToLiveKit(data.livekit.url, data.livekit.token, call.kind);

  } catch (error) {
    console.error('acceptCall failed:', error);
    showError(error.message);
    hideCallOverlay();
  }
}

// কল Decline করুন
async function declineCall() {
  const call = pendingIncomingCall;
  if (!call) return;

  hideIncomingCallBanner();
  pendingIncomingCall = null;

  try {
    await fetch(
      `${API_BASE}/rtc/conversations/${call.conversation_id}/decline`,
      {
        method: 'POST',
        headers: authHeaders(),
      }
    );
  } catch (error) {
    console.warn('Decline warning:', error);
  }
}
```

---

### ৭.৪ LiveKit-এ Connect করা

```javascript
async function connectToLiveKit(serverUrl, accessToken, kind) {
  // আগের call থাকলে disconnect করুন
  if (lkRoom) {
    await leaveCall();
  }

  const { Room, RoomEvent } = window.LivekitClient;

  lkRoom = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  // Event listeners
  lkRoom.on(RoomEvent.ParticipantConnected, (participant) => {
    console.log(`${participant.identity} যোগ দিয়েছে`);
    updateCallStatus(`${participant.identity} joined`);
  });

  lkRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
    removeParticipantVideo(participant.identity);
    updateCallStatus(`${participant.identity} চলে গেছে`);
  });

  lkRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    attachTrack(track, participant.identity);
  });

  lkRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    detachTrack(track, participant.identity);
  });

  lkRoom.on(RoomEvent.Disconnected, () => {
    cleanupCallUI();
  });

  // LiveKit server-এ connect করুন
  await lkRoom.connect(serverUrl, accessToken);

  // Mic চালু করুন
  try {
    await lkRoom.localParticipant.setMicrophoneEnabled(true);
  } catch (err) {
    micEnabled = false;
    showError('মাইক্রোফোন পাওয়া যায়নি — শুনতে পাবেন কিন্তু বলতে পারবেন না');
  }

  // Video call হলে Camera চালু করুন
  if (kind === 'VIDEO') {
    try {
      await lkRoom.localParticipant.setCameraEnabled(true);
      showLocalVideo(lkRoom.localParticipant);
    } catch (err) {
      camEnabled = false;
      showError('ক্যামেরা পাওয়া যায়নি — শুধু অডিও দিয়ে চলবে');
    }
  }

  updateCallStatus(`${kind} call connected`);
}
```

---

### ৭.৫ Video Track Attach/Detach

```javascript
function attachTrack(track, identity) {
  if (track.kind !== 'video' && track.kind !== 'audio') return;

  let wrapper = document.getElementById(`participant-${identity}`);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = `participant-${identity}`;
    wrapper.className = 'participant-video-wrapper';

    const nameLabel = document.createElement('span');
    nameLabel.textContent = identity;
    wrapper.appendChild(nameLabel);

    document.getElementById('remote-participants').appendChild(wrapper);
  }

  if (track.kind === 'video') {
    let videoEl = wrapper.querySelector('video');
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.style.width = '100%';
      wrapper.appendChild(videoEl);
    }
    track.attach(videoEl);
  } else {
    // Audio
    let audioEl = wrapper.querySelector('audio');
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      wrapper.appendChild(audioEl);
    }
    track.attach(audioEl);
    audioEl.play().catch(err => console.warn('Audio autoplay blocked:', err));
  }
}

function detachTrack(track, identity) {
  const wrapper = document.getElementById(`participant-${identity}`);
  if (!wrapper) return;

  const el = wrapper.querySelector(track.kind === 'video' ? 'video' : 'audio');
  if (el) {
    track.detach(el);
    el.remove();
  }

  // Wrapper-এ কিছু না থাকলে সরিয়ে দিন
  if (!wrapper.querySelector('video') && !wrapper.querySelector('audio')) {
    wrapper.remove();
  }
}

function removeParticipantVideo(identity) {
  document.getElementById(`participant-${identity}`)?.remove();
}
```

---

### ৭.৬ কল থেকে বের হওয়া

```javascript
async function leaveCall() {
  const convId = currentConversationId;

  try {
    // LiveKit থেকে disconnect করুন
    if (lkRoom) {
      lkRoom.disconnect();
    }

    // Backend-কে জানান
    if (convId) {
      await fetch(`${API_BASE}/rtc/conversations/${convId}/leave`, {
        method: 'POST',
        headers: authHeaders(),
      });
    }
  } catch (error) {
    console.warn('Leave error:', error);
  } finally {
    cleanupCallUI();
  }
}

function cleanupCallUI() {
  document.getElementById('remote-participants').innerHTML = '';
  document.getElementById('local-video').srcObject = null;
  lkRoom = null;
  micEnabled = true;
  camEnabled = true;
  currentCallKind = 'VIDEO';
  hideCallOverlay();
}
```

---

### ৭.৭ Call Ended Event Handle করা

```javascript
// WebSocket থেকে call:ended listen করুন
socket.on('call:ended', (payload) => {
  if (payload.conversation_id !== currentConversationId) return;

  // LiveKit disconnect করুন
  if (lkRoom) {
    lkRoom.disconnect();
    lkRoom = null;
  }

  cleanupCallUI();

  const reasons = {
    'ended': 'কল শেষ করা হয়েছে',
    'empty_room': 'সবাই চলে গেছে, কল শেষ',
    'declined': 'কল decline করা হয়েছে',
  };
  showMessage(reasons[payload.reason] || 'কল শেষ');
});
```

---

### ৭.৮ Token Refresh (Reconnect)

```javascript
// Token মেয়াদ শেষের ৯০ সেকেন্ড আগে refresh করুন
// TTL = 600s, তাই 510s পরে refresh করুন
let tokenRefreshTimer = null;

function scheduleTokenRefresh(conversationId) {
  clearTimeout(tokenRefreshTimer);
  tokenRefreshTimer = setTimeout(async () => {
    if (!lkRoom || !conversationId) return;
    await refreshCallToken(conversationId);
  }, 510 * 1000); // ৮.৫ মিনিট পরে
}

async function refreshCallToken(conversationId) {
  try {
    const resp = await fetch(
      `${API_BASE}/rtc/conversations/${conversationId}/token`,
      {
        method: 'POST',
        headers: authHeaders(),
      }
    );

    if (!resp.ok) throw new Error('Token refresh failed');

    const { data } = await resp.json();

    // LiveKit room-এ নতুন token দিন
    // (আবার connect করুন — room.connect() পুরনো connection বন্ধ করে নতুন করে)
    await lkRoom.connect(data.livekit.url, data.livekit.token);

    // পরের refresh schedule করুন
    scheduleTokenRefresh(conversationId);

  } catch (error) {
    console.error('Token refresh failed:', error);
  }
}
```

---

## ৮. Flutter Implementation (Dart)

Flutter-এ `pubspec.yaml`-এ package যোগ করুন:

```yaml
dependencies:
  livekit_client: ^2.2.0
  socket_io_client: ^2.0.3+1
  http: ^1.2.0
```

---

### ৮.১ Call Service

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:livekit_client/livekit_client.dart';

class RtcService {
  static const String _apiBase = 'http://your-server.com/api';
  final String _token; // JWT token

  RtcService(this._token);

  Map<String, String> get _headers => {
    'Authorization': 'Bearer $_token',
    'Content-Type': 'application/json',
  };

  // কল শুরু করা
  Future<Map<String, dynamic>> startCall(
    String conversationId, {
    String kind = 'VIDEO',
  }) async {
    final resp = await http.post(
      Uri.parse('$_apiBase/rtc/conversations/$conversationId/start'),
      headers: _headers,
      body: jsonEncode({'kind': kind}),
    );

    if (resp.statusCode != 200 && resp.statusCode != 201) {
      final error = jsonDecode(resp.body);
      throw Exception(error['message'] ?? 'Call শুরু করা যায়নি');
    }

    return jsonDecode(resp.body);
  }

  // চলমান কলে যোগ দেওয়া
  Future<Map<String, dynamic>> joinCall(String conversationId) async {
    final resp = await http.post(
      Uri.parse('$_apiBase/rtc/conversations/$conversationId/join'),
      headers: _headers,
    );

    if (resp.statusCode != 200 && resp.statusCode != 201) {
      final error = jsonDecode(resp.body);
      throw Exception(error['message'] ?? 'Join করা যায়নি');
    }

    return jsonDecode(resp.body);
  }

  // Token refresh
  Future<Map<String, dynamic>> refreshToken(String conversationId) async {
    final resp = await http.post(
      Uri.parse('$_apiBase/rtc/conversations/$conversationId/token'),
      headers: _headers,
    );

    if (resp.statusCode != 200 && resp.statusCode != 201) {
      throw Exception('Token refresh ব্যর্থ হয়েছে');
    }

    return jsonDecode(resp.body);
  }

  // Decline করা
  Future<void> declineCall(String conversationId) async {
    await http.post(
      Uri.parse('$_apiBase/rtc/conversations/$conversationId/decline'),
      headers: _headers,
    );
  }

  // বের হওয়া
  Future<void> leaveCall(String conversationId) async {
    await http.post(
      Uri.parse('$_apiBase/rtc/conversations/$conversationId/leave'),
      headers: _headers,
    );
  }

  // জোর করে শেষ করা
  Future<void> endCall(String conversationId) async {
    await http.post(
      Uri.parse('$_apiBase/rtc/conversations/$conversationId/end'),
      headers: _headers,
    );
  }

  // Media state update
  Future<void> updateMediaState(
    String conversationId, {
    bool? camera,
    bool? microphone,
    bool? isScreenSharing,
  }) async {
    final body = <String, dynamic>{};
    if (camera != null) body['camera'] = camera;
    if (microphone != null) body['microphone'] = microphone;
    if (isScreenSharing != null) body['is_screen_sharing'] = isScreenSharing;

    await http.patch(
      Uri.parse(
        '$_apiBase/rtc/conversations/$conversationId/participants/me',
      ),
      headers: _headers,
      body: jsonEncode(body),
    );
  }

  // Call state দেখা
  Future<Map<String, dynamic>?> getCallState(String conversationId) async {
    final resp = await http.get(
      Uri.parse('$_apiBase/rtc/conversations/$conversationId/state'),
      headers: _headers,
    );

    final data = jsonDecode(resp.body);
    return data['data'];
  }
}
```

---

### ৮.২ LiveKit Call Manager

```dart
import 'package:livekit_client/livekit_client.dart';
import 'dart:async';

class LiveKitCallManager {
  Room? _room;
  LocalAudioTrack? _audioTrack;
  LocalVideoTrack? _videoTrack;

  // Participant UI update callback
  final Function(List<RemoteParticipant>) onParticipantsChanged;
  // Call ended callback
  final VoidCallback onCallEnded;

  LiveKitCallManager({
    required this.onParticipantsChanged,
    required this.onCallEnded,
  });

  Room? get room => _room;
  bool get isConnected => _room?.connectionState == ConnectionState.connected;

  // LiveKit-এ connect করুন
  Future<void> connect({
    required String url,
    required String token,
    required String kind, // 'VIDEO' বা 'AUDIO'
  }) async {
    // আগের connection থাকলে বন্ধ করুন
    await disconnect();

    _room = Room();

    // Event listeners
    _room!.addListener(_onRoomEvent);

    // Connect করুন
    await _room!.connect(
      url,
      token,
      roomOptions: const RoomOptions(
        adaptiveStream: true,
        dynacast: true,
      ),
    );

    // Mic চালু করুন
    _audioTrack = await LocalAudioTrack.create(
      const AudioCaptureOptions(),
    );
    await _room!.localParticipant?.publishAudioTrack(_audioTrack!);

    // Video call হলে Camera চালু করুন
    if (kind == 'VIDEO') {
      _videoTrack = await LocalVideoTrack.createCameraTrack(
        const CameraCaptureOptions(
          cameraPosition: CameraPosition.front,
        ),
      );
      await _room!.localParticipant?.publishVideoTrack(_videoTrack!);
    }
  }

  void _onRoomEvent() {
    if (_room == null) return;

    // Participant list update
    final participants = _room!.remoteParticipants.values.toList();
    onParticipantsChanged(participants);

    // Room disconnect হলে
    if (_room!.connectionState == ConnectionState.disconnected) {
      onCallEnded();
    }
  }

  // Mic toggle
  Future<void> toggleMicrophone() async {
    final participant = _room?.localParticipant;
    if (participant == null) return;

    final isMuted = participant.isMuted;
    await participant.setMicrophoneEnabled(isMuted);
  }

  // Camera toggle
  Future<void> toggleCamera() async {
    final participant = _room?.localParticipant;
    if (participant == null) return;

    final isCameraEnabled = participant.isCameraEnabled();
    await participant.setCameraEnabled(!isCameraEnabled);
  }

  // Camera switch (front/back)
  Future<void> switchCamera() async {
    if (_videoTrack == null) return;
    await _videoTrack!.switchCamera();
  }

  // Speaker toggle
  Future<void> toggleSpeaker(bool useSpeaker) async {
    await Hardware.instance.setSpeakerphoneOn(useSpeaker);
  }

  // Disconnect
  Future<void> disconnect() async {
    _audioTrack?.stop();
    _videoTrack?.stop();
    _audioTrack = null;
    _videoTrack = null;

    await _room?.disconnect();
    _room?.removeListener(_onRoomEvent);
    _room?.dispose();
    _room = null;
  }
}
```

---

### ৮.৩ WebSocket Event Listener (Socket.IO)

```dart
import 'package:socket_io_client/socket_io_client.dart' as io;

class CallSocketListener {
  final io.Socket _socket;

  // Callbacks
  final Function(Map<String, dynamic>) onCallIncoming;
  final Function(Map<String, dynamic>) onCallEnded;
  final Function(Map<String, dynamic>) onParticipantJoined;
  final Function(Map<String, dynamic>) onParticipantLeft;
  final Function(Map<String, dynamic>) onParticipantUpdated;
  final Function(Map<String, dynamic>) onCallDeclined;

  CallSocketListener({
    required io.Socket socket,
    required this.onCallIncoming,
    required this.onCallEnded,
    required this.onParticipantJoined,
    required this.onParticipantLeft,
    required this.onParticipantUpdated,
    required this.onCallDeclined,
  }) : _socket = socket {
    _registerListeners();
  }

  void _registerListeners() {
    _socket.on('call:incoming', (data) {
      onCallIncoming(Map<String, dynamic>.from(data));
    });

    _socket.on('call:ended', (data) {
      onCallEnded(Map<String, dynamic>.from(data));
    });

    _socket.on('call:participant_joined', (data) {
      onParticipantJoined(Map<String, dynamic>.from(data));
    });

    _socket.on('call:participant_left', (data) {
      onParticipantLeft(Map<String, dynamic>.from(data));
    });

    _socket.on('call:participant_updated', (data) {
      onParticipantUpdated(Map<String, dynamic>.from(data));
    });

    _socket.on('call:declined', (data) {
      onCallDeclined(Map<String, dynamic>.from(data));
    });
  }

  void dispose() {
    _socket.off('call:incoming');
    _socket.off('call:ended');
    _socket.off('call:participant_joined');
    _socket.off('call:participant_left');
    _socket.off('call:participant_updated');
    _socket.off('call:declined');
  }
}
```

---

### ৮.৪ CallScreen Widget

```dart
import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';

class CallScreen extends StatefulWidget {
  final String conversationId;
  final String kind; // 'VIDEO' বা 'AUDIO'
  final bool isIncoming; // true = incoming, false = outgoing
  final Map<String, dynamic>? incomingCallData;

  const CallScreen({
    super.key,
    required this.conversationId,
    required this.kind,
    this.isIncoming = false,
    this.incomingCallData,
  });

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  late final RtcService _rtcService;
  late final LiveKitCallManager _callManager;
  late final CallSocketListener _socketListener;

  bool _micEnabled = true;
  bool _camEnabled = true;
  bool _speakerEnabled = true;
  bool _isConnected = false;
  String _statusText = 'Connecting...';
  List<RemoteParticipant> _remoteParticipants = [];

  @override
  void initState() {
    super.initState();
    _rtcService = RtcService(/* your JWT token */);

    _callManager = LiveKitCallManager(
      onParticipantsChanged: (participants) {
        setState(() => _remoteParticipants = participants);
      },
      onCallEnded: _onCallEnded,
    );

    // Socket listeners সেটআপ
    _socketListener = CallSocketListener(
      socket: yourSocket, // আপনার socket instance
      onCallIncoming: (_) {}, // এই screen-এ দরকার নেই
      onCallEnded: (data) => _onCallEnded(),
      onParticipantJoined: (data) {
        setState(() {
          _statusText = '${data['user']?['name']} যোগ দিয়েছে';
        });
      },
      onParticipantLeft: (data) {
        setState(() {
          _statusText = 'একজন চলে গেছে';
        });
      },
      onParticipantUpdated: (_) {},
      onCallDeclined: (_) {},
    );

    _startOrJoin();
  }

  Future<void> _startOrJoin() async {
    try {
      Map<String, dynamic> response;

      if (widget.isIncoming) {
        // Incoming call — join করুন
        response = await _rtcService.joinCall(widget.conversationId);
      } else {
        // Outgoing call — start করুন
        response = await _rtcService.startCall(
          widget.conversationId,
          kind: widget.kind,
        );
      }

      final livekit = response['data']['livekit'];
      await _callManager.connect(
        url: livekit['url'],
        token: livekit['token'],
        kind: widget.kind,
      );

      setState(() {
        _isConnected = true;
        _statusText = '${widget.kind} call connected';
      });

    } catch (error) {
      setState(() => _statusText = 'Error: $error');
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) Navigator.pop(context);
    }
  }

  Future<void> _toggleMic() async {
    await _callManager.toggleMicrophone();
    setState(() => _micEnabled = !_micEnabled);

    // Backend sync
    await _rtcService.updateMediaState(
      widget.conversationId,
      microphone: _micEnabled,
    );
  }

  Future<void> _toggleCamera() async {
    await _callManager.toggleCamera();
    setState(() => _camEnabled = !_camEnabled);

    // Backend sync
    await _rtcService.updateMediaState(
      widget.conversationId,
      camera: _camEnabled,
    );
  }

  Future<void> _hangUp() async {
    await _callManager.disconnect();
    await _rtcService.leaveCall(widget.conversationId);
    if (mounted) Navigator.pop(context);
  }

  void _onCallEnded() {
    _callManager.disconnect();
    if (mounted) Navigator.pop(context);
  }

  @override
  void dispose() {
    _socketListener.dispose();
    _callManager.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            // Remote participants video
            if (widget.kind == 'VIDEO')
              _buildVideoGrid()
            else
              _buildAudioCallUI(),

            // Status text
            Positioned(
              top: 16,
              left: 0,
              right: 0,
              child: Text(
                _statusText,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 14),
              ),
            ),

            // Local video (video call হলে)
            if (widget.kind == 'VIDEO' && _callManager.room != null)
              Positioned(
                bottom: 120,
                right: 16,
                child: SizedBox(
                  width: 100,
                  height: 150,
                  child: VideoTrackRenderer(
                    _callManager.room!.localParticipant!
                        .videoTrackPublications.values.first.track
                        as VideoTrack,
                  ),
                ),
              ),

            // Control buttons
            Positioned(
              bottom: 32,
              left: 0,
              right: 0,
              child: _buildControls(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoGrid() {
    if (_remoteParticipants.isEmpty) {
      return const Center(
        child: Text('অপেক্ষা করুন...', style: TextStyle(color: Colors.white)),
      );
    }

    return GridView.builder(
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: _remoteParticipants.length == 1 ? 1 : 2,
        childAspectRatio: 3 / 4,
      ),
      itemCount: _remoteParticipants.length,
      itemBuilder: (context, index) {
        final participant = _remoteParticipants[index];
        final videoTrack = participant.videoTrackPublications.values
            .where((pub) => !pub.muted)
            .firstOrNull
            ?.track as VideoTrack?;

        return Stack(
          children: [
            if (videoTrack != null)
              VideoTrackRenderer(videoTrack)
            else
              Container(
                color: Colors.grey[900],
                child: Center(
                  child: CircleAvatar(
                    radius: 40,
                    child: Text(
                      participant.identity.substring(0, 1).toUpperCase(),
                    ),
                  ),
                ),
              ),
            Positioned(
              bottom: 8,
              left: 8,
              child: Text(
                participant.identity,
                style: const TextStyle(
                  color: Colors.white,
                  shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildAudioCallUI() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.phone, size: 80, color: Colors.white),
          const SizedBox(height: 16),
          Text(
            _statusText,
            style: const TextStyle(color: Colors.white, fontSize: 18),
          ),
          const SizedBox(height: 8),
          Text(
            '${_remoteParticipants.length} জন active',
            style: const TextStyle(color: Colors.white60),
          ),
        ],
      ),
    );
  }

  Widget _buildControls() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        // Mic toggle
        _ControlButton(
          icon: _micEnabled ? Icons.mic : Icons.mic_off,
          label: _micEnabled ? 'Mute' : 'Unmute',
          color: _micEnabled ? Colors.white : Colors.red,
          onTap: _toggleMic,
        ),

        // Hang up
        _ControlButton(
          icon: Icons.call_end,
          label: 'End',
          color: Colors.red,
          backgroundColor: Colors.red.withOpacity(0.2),
          onTap: _hangUp,
        ),

        // Camera toggle (video call হলে)
        if (widget.kind == 'VIDEO')
          _ControlButton(
            icon: _camEnabled ? Icons.videocam : Icons.videocam_off,
            label: _camEnabled ? 'Camera Off' : 'Camera On',
            color: _camEnabled ? Colors.white : Colors.red,
            onTap: _toggleCamera,
          ),

        // Speaker toggle
        _ControlButton(
          icon: _speakerEnabled ? Icons.volume_up : Icons.volume_off,
          label: _speakerEnabled ? 'Speaker' : 'Earpiece',
          color: Colors.white,
          onTap: () async {
            setState(() => _speakerEnabled = !_speakerEnabled);
            await _callManager.toggleSpeaker(_speakerEnabled);
          },
        ),
      ],
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color? backgroundColor;
  final VoidCallback onTap;

  const _ControlButton({
    required this.icon,
    required this.label,
    required this.color,
    this.backgroundColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: backgroundColor ?? Colors.white12,
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        ],
      ),
    );
  }
}
```

---

### ৮.৫ Incoming Call Banner Widget

```dart
class IncomingCallBanner extends StatelessWidget {
  final Map<String, dynamic> callData;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const IncomingCallBanner({
    super.key,
    required this.callData,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  Widget build(BuildContext context) {
    final callerName = callData['caller']?['name'] ?? 'Unknown';
    final kind = callData['kind'] ?? 'VIDEO';
    final icon = kind == 'VIDEO' ? Icons.videocam : Icons.call;

    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.grey[900],
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(icon, color: Colors.green, size: 32),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$callerName calling...',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    '${kind.toLowerCase()} call',
                    style: const TextStyle(color: Colors.white60, fontSize: 12),
                  ),
                ],
              ),
            ),
            // Decline
            GestureDetector(
              onTap: onDecline,
              child: const CircleAvatar(
                backgroundColor: Colors.red,
                child: Icon(Icons.call_end, color: Colors.white),
              ),
            ),
            const SizedBox(width: 12),
            // Accept
            GestureDetector(
              onTap: onAccept,
              child: const CircleAvatar(
                backgroundColor: Colors.green,
                child: Icon(Icons.call, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

### ৮.৬ Token Refresh (Flutter)

```dart
class CallTokenRefreshManager {
  Timer? _refreshTimer;
  final RtcService _rtcService;
  final LiveKitCallManager _callManager;

  CallTokenRefreshManager(this._rtcService, this._callManager);

  // Call শুরু হলে timer চালু করুন
  void startRefreshTimer(String conversationId) {
    _refreshTimer?.cancel();
    // ৮.৫ মিনিট পরে refresh (TTL ১০ মিনিট)
    _refreshTimer = Timer(const Duration(seconds: 510), () async {
      await _refresh(conversationId);
    });
  }

  Future<void> _refresh(String conversationId) async {
    try {
      final response = await _rtcService.refreshToken(conversationId);
      final livekit = response['data']['livekit'];

      // নতুন token দিয়ে reconnect
      await _callManager.room?.connect(
        livekit['url'],
        livekit['token'],
      );

      // পরের refresh schedule করুন
      startRefreshTimer(conversationId);

    } catch (e) {
      debugPrint('Token refresh failed: $e');
    }
  }

  void cancel() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }
}
```

---

## ৯. Media State Sync

Camera/Mic toggle করার পর Backend-কে জানানো উচিত — তাহলে অন্য participants WebSocket দিয়ে `call:participant_updated` পাবে এবং তাদের UI update হবে।

### Web:
```javascript
async function toggleMic() {
  micEnabled = !micEnabled;
  await lkRoom.localParticipant.setMicrophoneEnabled(micEnabled);

  // Backend sync
  await fetch(`${API_BASE}/rtc/conversations/${currentConversationId}/participants/me`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ microphone: micEnabled }),
  });
}
```

### Flutter:
```dart
Future<void> toggleMic() async {
  await _callManager.toggleMicrophone();
  final newState = !_micEnabled;
  setState(() => _micEnabled = newState);

  // Backend sync
  await _rtcService.updateMediaState(
    widget.conversationId,
    microphone: newState,
  );
}
```

### অন্য participant-এর media state UI তে দেখানো:

```javascript
// Web
socket.on('call:participant_updated', (data) => {
  const { participant } = data;
  updateParticipantUI(participant.user_id, {
    micOn: participant.microphone,
    camOn: participant.camera,
    screenSharing: participant.is_screen_sharing,
  });
});
```

```dart
// Flutter — CallSocketListener callback-এ
onParticipantUpdated: (data) {
  final participant = data['participant'];
  setState(() {
    // participant.user_id এর জন্য UI update করুন
    _updateParticipantStatus(
      participant['user_id'],
      micOn: participant['microphone'],
      camOn: participant['camera'],
    );
  });
},
```

---

## ১০. Call Message — Chat Timeline-এ কল দেখানো

WhatsApp, Messenger-এর মতো — কেউ call দিলে সেটা conversation-এ **message হিসেবে** দেখা যাবে। Call শেষ হলে message-এ duration এবং status update হয়।

### ১০.১ Message Content Structure

যখন কল শুরু হয় (`POST /start`) → Backend একটা `CALL` kind message তৈরি করে:

```json
{
  "id": "msg_xyz",
  "conversation_id": "conv_abc",
  "kind": "CALL",
  "call_session_id": "session_id",
  "content": {
    "call_kind": "VIDEO",
    "status": "ONGOING",
    "duration_seconds": null,
    "reason": null
  },
  "sender": { "id": "user_alice", "name": "Alice", "avatar": "..." },
  "created_at": "2026-01-01T10:00:00.000Z"
}
```

যখন কল শেষ হয় → content আপডেট হয়:

```json
{
  "content": {
    "call_kind": "VIDEO",
    "status": "ENDED",
    "duration_seconds": 125,
    "reason": "ended"
  }
}
```

**`status` এর মান:**

| status | কখন সেট হয় |
|--------|-----------|
| `"ONGOING"` | কল শুরু হয়েছে, চলছে |
| `"ENDED"` | কল শেষ হয়েছে (কেউ কথা বলেছে) |
| `"MISSED"` | কেউ ধরেনি / decline করা হয়েছে |

**`reason` এর মান:**

| reason | কখন |
|--------|-----|
| `"ended"` | জোর করে শেষ করা হয়েছে |
| `"empty_room"` | সবাই চলে গেছে |
| `"declined"` | DM call decline হয়েছে |

---

### ১০.২ WebSocket Events

#### `message:new` — প্রথমে call শুরু হলে
কল শুরুর সাথে সাথে সব members-এ এই event আসবে (existing message:new flow দিয়ে):
```json
{
  "id": "msg_xyz",
  "kind": "CALL",
  "content": { "call_kind": "VIDEO", "status": "ONGOING", ... },
  "call_session_id": "session_id",
  "sender": { ... }
}
```

#### `call:message_updated` — কল শেষ হলে message আপডেট
```json
{
  "conversation_id": "conv_abc",
  "message": {
    "id": "msg_xyz",
    "kind": "CALL",
    "call_session_id": "session_id",
    "content": {
      "call_kind": "VIDEO",
      "status": "ENDED",
      "duration_seconds": 125,
      "reason": "ended"
    },
    "sender": { "id": "user_alice", "name": "Alice", "avatar": "..." },
    "created_at": "2026-01-01T10:00:00.000Z"
  }
}
```

> **Client rule:** `call:message_updated` পেলে message list-এ ওই message-এর `id` দিয়ে খুঁজে update করুন (upsert by id)।

---

### ১০.৩ Web — Call Message UI (JavaScript)

```javascript
// message:new event-এ CALL kind handle করুন
socket.on('message:new', (message) => {
  if (message.kind === 'CALL') {
    renderCallMessage(message);
  } else {
    renderTextMessage(message);
  }
});

// call:message_updated — duration আপডেট হলে
socket.on('call:message_updated', ({ conversation_id, message }) => {
  if (conversation_id !== currentConversationId) return;
  updateCallMessageInUI(message);
});

// Call message render করুন
function renderCallMessage(message) {
  const content = message.content;
  const isVideo = content.call_kind === 'VIDEO';
  const icon = isVideo ? '📹' : '📞';

  let label = '';
  if (content.status === 'ONGOING') {
    label = `${icon} ${isVideo ? 'Video' : 'Audio'} call চলছে...`;
  } else if (content.status === 'MISSED') {
    label = `${icon} Missed ${isVideo ? 'video' : 'audio'} call`;
  } else {
    const mins = Math.floor((content.duration_seconds || 0) / 60);
    const secs = (content.duration_seconds || 0) % 60;
    const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    label = `${icon} ${isVideo ? 'Video' : 'Audio'} call • ${duration}`;
  }

  const el = document.getElementById(`msg-${message.id}`) || createMessageEl(message.id);

  el.innerHTML = `
    <div class="call-message ${content.status.toLowerCase()}">
      <span class="call-icon">${icon}</span>
      <div class="call-info">
        <span class="call-label">${label}</span>
        <span class="call-time">${formatTime(message.created_at)}</span>
      </div>
    </div>
  `;

  if (!document.getElementById(`msg-${message.id}`)) {
    document.getElementById('messages-list').appendChild(el);
  }
}

// আপডেট হলে existing element খুঁজে বের করুন
function updateCallMessageInUI(message) {
  const el = document.getElementById(`msg-${message.id}`);
  if (el) {
    renderCallMessage(message); // re-render করুন
  }
}
```

---

### ১০.৪ Flutter — Call Message Widget

```dart
// Message model-এ call content parse করুন
class CallMessageContent {
  final String callKind;    // 'AUDIO' | 'VIDEO'
  final String status;      // 'ONGOING' | 'ENDED' | 'MISSED'
  final int? durationSeconds;
  final String? reason;

  CallMessageContent.fromJson(Map<String, dynamic> json)
      : callKind = json['call_kind'] ?? 'VIDEO',
        status = json['status'] ?? 'ONGOING',
        durationSeconds = json['duration_seconds'] as int?,
        reason = json['reason'] as String?;
}

// CallMessageBubble widget
class CallMessageBubble extends StatelessWidget {
  final Map<String, dynamic> message;

  const CallMessageBubble({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final content = CallMessageContent.fromJson(
      Map<String, dynamic>.from(message['content'] ?? {}),
    );

    final isVideo = content.callKind == 'VIDEO';
    final icon = isVideo ? Icons.videocam : Icons.call;

    Color bgColor;
    IconData statusIcon;
    String label;

    switch (content.status) {
      case 'ONGOING':
        bgColor = Colors.green.shade100;
        statusIcon = icon;
        label = isVideo ? 'Video call চলছে...' : 'Audio call চলছে...';
        break;
      case 'MISSED':
        bgColor = Colors.red.shade50;
        statusIcon = isVideo ? Icons.videocam_off : Icons.phone_missed;
        label = isVideo ? 'Missed video call' : 'Missed audio call';
        break;
      default: // ENDED
        bgColor = Colors.grey.shade100;
        statusIcon = icon;
        final secs = content.durationSeconds ?? 0;
        final mins = secs ~/ 60;
        final rem = secs % 60;
        final dur = mins > 0 ? '${mins}m ${rem}s' : '${rem}s';
        label = isVideo ? 'Video call • $dur' : 'Audio call • $dur';
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(statusIcon, size: 22, color: Colors.grey.shade700),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
              ),
              Text(
                _formatTime(message['created_at']),
                style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatTime(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

// Message list-এ ব্যবহার করুন
Widget buildMessageBubble(Map<String, dynamic> message) {
  if (message['kind'] == 'CALL') {
    return CallMessageBubble(message: message);
  }
  return TextMessageBubble(message: message);
}
```

**Socket-এ `call:message_updated` listen করুন:**

```dart
// CallSocketListener-এ যোগ করুন
_socket.on('call:message_updated', (data) {
  final updated = Map<String, dynamic>.from(data);
  final message = Map<String, dynamic>.from(updated['message']);

  // Messages state-এ id দিয়ে খুঁজে update করুন
  setState(() {
    final index = messages.indexWhere((m) => m['id'] == message['id']);
    if (index != -1) {
      messages[index] = message; // upsert
    }
  });
});
```

---

## ১১. Edge Cases ও গুরুত্বপূর্ণ নিয়ম

| পরিস্থিতি | কী হবে |
|----------|--------|
| Caller call শুরু করে, কেউ join করেনি, caller চলে গেল | `remaining = 0` → session শেষ, কোনো event নেই (recipient নেই) |
| DM call decline হলে | Session → `ENDED`, caller পাবে `call:ended` (reason: `"declined"`) |
| Group call decline হলে | Session চলতে থাকে, সবাই পাবে `call:declined` |
| Group-এর শেষ member চলে গেলে | Session → `ENDED`, `call:ended` (reason: `"empty_room"`) |
| `/start` করলে আগে থেকে কল চলছে | আগের session ফেরত, নতুন token, `already_active: true` |
| `/join` দুবার করলে | দ্বিতীয়বার `already_joined: true`, `call:participant_joined` আসবে না |
| `/token` দিয়ে reconnect (আগে ছিল) | `already_joined: true`, event নেই |
| `/token` দিয়ে reconnect (app kill হয়েছিল) | নতুন participant record, `call:participant_joined` আসবে |
| Group rename হলো call চলাকালে | `room_name` DB-তে persisted — সবাই একই LiveKit room-এ থাকবে |
| Admin group call force-end করল | সবাই পাবে `call:ended` (reason: `"ended"`) |
| Blocked user call করার চেষ্টা করল | `403 Forbidden` error |
| Member না হয়ে join করার চেষ্টা | `403 Forbidden` error |

---

## ১১. সাধারণ সমস্যা ও সমাধান

### সমস্যা: "No active call found" error আসছে join করতে গেলে
**কারণ:** Call decline বা end হয়ে গেছে join করার আগেই।  
**সমাধান:** `call:ended` event listen করুন এবং incoming call UI বন্ধ করুন।

---

### সমস্যা: দুজন participant আলাদা LiveKit room-এ চলে গেছে
**কারণ:** এটা একটি পুরনো bug ছিল — room name conversation title থেকে তৈরি হতো।  
**স্ট্যাটাস:** ✅ **Fix করা হয়েছে।** এখন `room_name` session তৈরির সময় DB-তে save হয় এবং আর বদলায় না।

---

### সমস্যা: ১০ মিনিট পরে LiveKit disconnect হয়ে যাচ্ছে
**কারণ:** LiveKit token TTL = ১০ মিনিট।  
**সমাধান:** ৮-৯ মিনিট পরে `POST /token` করে নতুন token নিয়ে reconnect করুন। Token Refresh section দেখুন।

---

### সমস্যা: Reconnect করলে `call:participant_joined` পাচ্ছি না
**কারণ:** আগে থেকে active participant হলে (`already_joined: true`) event আসে না — এটা intentional।  
**যদি absent ছিলেন:** `/token` call করলে নতুন participant record হয় এবং event আসে।

---

### সমস্যা: DM call-এ একজন hang up করলে অন্যজনেরও call শেষ হয়ে যাচ্ছিল
**স্ট্যাটাস:** ✅ **Fix করা হয়েছে।** DM এবং Group উভয়ের জন্য এখন একই নিয়ম — শেষ participant চলে গেলে call শেষ।

---

### সমস্যা: Flutter-এ camera permission error
**সমাধান:** `AndroidManifest.xml` এবং `Info.plist`-এ permission যোগ করুন:

```xml
<!-- Android: AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

```xml
<!-- iOS: Info.plist -->
<key>NSCameraUsageDescription</key>
<string>Video call-এর জন্য ক্যামেরা প্রয়োজন</string>
<key>NSMicrophoneUsageDescription</key>
<string>Call-এর জন্য মাইক্রোফোন প্রয়োজন</string>
```

---

### সমস্যা: `LIVEKIT env vars missing` error
**সমাধান:** `.env` ফাইলে এগুলো আছে কিনা চেক করুন:
```env
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_URL=wss://your-server.com
LIVEKIT_PUBLIC_URL=wss://your-server.com
```
`GET /api/rtc/health` দিয়ে verify করুন।

---

> **সাথে পড়ুন:** Socket connection setup এর জন্য [`socket_implementation_guide.md`](./socket_implementation_guide.md) দেখুন।
