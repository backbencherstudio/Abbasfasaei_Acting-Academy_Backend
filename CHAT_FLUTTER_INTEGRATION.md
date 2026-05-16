# Flutter Integration Guide: Chat and Calling

This document is for the Flutter team to integrate all implemented chat and calling features from the backend.

Scope covered:
- Direct message and group conversation APIs
- Messaging APIs including attachment upload
- Realtime Socket.IO events
- Voice/video call APIs with LiveKit token flow
- User search and block APIs used by chat
- Known caveats and production notes

This guide is based on the current implementation under src/modules/chat.

## 1. Base Configuration

### 1.1 Base URLs
- REST base: {BACKEND_ORIGIN}/api
- Socket.IO namespace: {BACKEND_ORIGIN}/ws

Example local values:
- REST: http://localhost:4000/api
- Socket namespace: http://localhost:4000/ws

### 1.2 Authentication
- All chat/call REST endpoints require Authorization header:
  Bearer {access_token}
- Socket connection also requires JWT token, either:
  - auth.token
  - or Authorization header in handshake

### 1.3 Flutter packages (recommended)
- dio or http for REST
- socket_io_client for realtime
- livekit_client for calling

## 2. Data Model Cheatsheet

Important enums from Prisma:

- ConversationType: DM, GROUP
- MemberRole: ADMIN, MEMBER
- MessageKind: TEXT, IMAGE, FILE, AUDIO, VIDEO, SYSTEM
- CallKind: AUDIO, VIDEO

Core entities used by client:
- Conversation
  - id
  - type
  - title (group)
  - senderTitle, receiverTitle (dm labels)
  - memberships[]
  - messages[] (last message often included in list)
- Message
  - id
  - kind
  - content (json)
  - media_Url
  - createdAt
  - senderId
  - conversationId

## 3. REST API Reference

All routes below are relative to /api.

### 3.1 Conversations

1) Create DM
- POST /conversations/dm
- Body:

~~~json
{
  "otherUserId": "user_cuid"
}
~~~

- Behavior:
  - Creates a deterministic DM using dmKey
  - Returns existing DM if already created
  - Fails if blocked by either side

2) Create Group
- POST /conversations/group
- Body:

~~~json
{
  "title": "Acting Batch A",
  "memberIds": ["user1", "user2"],
  "avatarUrl": "optional"
}
~~~

3) List My Conversations
- GET /conversations?take=20&skip=0
- Returns conversations with unread count logic already computed server-side

4) List Group Conversations
- GET /conversations/group-conversations

5) Get Unread for a conversation
- GET /conversations/{conversationId}/unread

6) Mark Read
- PATCH /conversations/{conversationId}/read
- Body:

~~~json
{
  "at": "2026-03-11T10:10:10.000Z"
}
~~~

Alternative body field also supported: messageCreatedAt

7) Clear conversation for me
- PATCH /conversations/{conversationId}/clear
- Body optional:

~~~json
{
  "upTo": "2026-03-11T10:10:10.000Z"
}
~~~

8) Group member management
- POST /conversations/{conversationId}/members
  - Body: { memberIds: ["..."] }
- GET /conversations/{conversationId}/members
- PATCH /conversations/{conversationId}/members/{userId}/role
  - Body: { role: "ADMIN" | "MEMBER" }
- POST /conversations/{conversationId}/members/{userId}/remove

### 3.2 Messages

1) List messages (cursor pagination)
- GET /conversations/{conversationId}/messages?take=20&cursor={messageId}
- Returns:

~~~json
{
  "items": [ ...messages ],
  "nextCursor": "optional_message_id"
}
~~~

2) Upload and send message with attachment
- POST /conversations/{conversationId}/messages/upload
- Content-Type: multipart/form-data
- Fields:
  - media: binary file
  - kind: IMAGE | VIDEO | FILE | AUDIO (optional, default TEXT in dto)
  - content: JSON string (optional), for example caption and file metadata
  - media_Url: optional string (normally not needed; server sets URL after upload)

Sample content value:

~~~json
{
  "text": "caption",
  "fileName": "resume.pdf",
  "size": 12345,
  "mimeType": "application/pdf"
}
~~~

Response is a message object.

3) Delete message (soft delete)
- DELETE /messages/{messageId}
- Sender can delete own message
- Group ADMIN can delete any message in that group

4) Report message
- POST /messages/{messageId}/report
- Body:

~~~json
{
  "reason": "Spam"
}
~~~

5) Search text messages
- GET /messages/search?q=hello&conversationId={id}&take=20&skip=0

Note: Current dto validates conversationId as UUID, while project IDs are CUID. For reliability, prefer searching without conversationId filter until backend validation is aligned.

6) Media and files tabs
- GET /conversations/{conversationId}/media?take=20&cursor={messageId}
  - kinds: IMAGE, VIDEO
- GET /conversations/{conversationId}/files?take=20&cursor={messageId}
  - kind: FILE

### 3.3 User endpoints used by chat

1) Suggest users for DM/group add
- GET /users/suggest?q={query}&take=10

2) Block and unblock
- POST /users/{userId}/block
- DELETE /users/{userId}/block

Block effects:
- Cannot create/send DM if either side blocked the other.

### 3.4 Calling (RTC)

1) Start call
- POST /rtc/conversations/{conversationId}/start
- Body:

~~~json
{
  "kind": "AUDIO"
}
~~~

kind defaults to VIDEO if not provided.

2) Join active call
- POST /rtc/conversations/{conversationId}/join

3) Leave call
- POST /rtc/conversations/{conversationId}/leave

4) End call
- POST /rtc/conversations/{conversationId}/end

5) Issue LiveKit token for conversation
- POST /rtc/conversations/{conversationId}/token
- Response:

~~~json
{
  "success": true,
  "data": {
    "token": "livekit_jwt",
    "roomName": "derived-room-slug",
    "url": "ws://... or wss://...",
    "audioOnlySuggested": false
  }
}
~~~

6) RTC health
- GET /rtc/health

## 4. Realtime Socket.IO Events

Namespace: /ws

### 4.1 Connect

On success server emits:
- connection:ok
  - payload: { userId }

On auth failure server emits:
- connection:error
  - payload code examples: UNAUTHORIZED, USER_NOT_FOUND

Presence broadcasts:
- presence:update
  - payload: { userId, online }

### 4.2 Conversation room

Client emit:
- conversation:join
  - payload: { conversationId }

Server emits on success:
- conversation:joined
  - payload: { conversationId }

Server emits on failure:
- error:conversation
  - code examples: BAD_REQUEST, JOIN_FAILED

### 4.3 Realtime messaging

Client emit text/system message:
- message:send
  - payload:

~~~json
{
  "conversationId": "cuid",
  "kind": "TEXT",
  "content": {
    "text": "Hello"
  }
}
~~~

Server emits:
- message:new (to conversation members and echo to sender)
- message:ack (to sender)
  - payload: { messageId }

Server error event:
- error:message
  - code examples: BAD_MESSAGE, RATE_LIMIT, SEND_FAILED

Typing:
- Client emit typing
  - payload: { conversationId, on: true|false }
- Server emits typing to others in room
  - payload: { userId, userName, on }

Read receipts broadcast:
- Client emit message:read
  - payload: { conversationId, at?: isoDate }
- Server emits message:read
  - payload: { conversationId, userId, at }

### 4.4 Call signaling events

Server emits when call starts:
- call:incoming
  - payload: { conversationId, fromUserId, kind, at }

Server emits when call ends:
- call:ended
  - payload: { conversationId, byUserId, at }

## 5. Flutter Integration Sequence

### 5.1 App launch
1. Login and store access_token/refresh_token.
2. Initialize REST client with bearer token.
3. Initialize socket with namespace /ws and auth token.
4. Listen to connection:ok, presence:update, message:new, typing, call:incoming, call:ended.

### 5.2 Conversation screen
1. Fetch GET /conversations.
2. On tap conversation:
   - Emit conversation:join
   - Fetch GET /conversations/{id}/messages
   - Mark read using PATCH /conversations/{id}/read
3. For pagination use cursor from previous response.

### 5.3 Send text
1. Emit message:send over socket.
2. Optimistically render pending bubble with local id.
3. Replace/update on message:new or message:ack.

### 5.4 Send attachment
1. Build multipart request to /conversations/{id}/messages/upload.
2. Include media file, kind, and content JSON string for caption/metadata.
3. Render returned message object in timeline.

### 5.5 Calling flow (LiveKit)
1. Initiator calls POST /rtc/conversations/{id}/start with kind.
2. Receiver gets call:incoming via socket and displays incoming UI.
3. On accept, both sides request POST /rtc/conversations/{id}/token.
4. Connect LiveKit room using returned url and token.
5. Optionally call POST /rtc/conversations/{id}/join.
6. On leave call POST /rtc/conversations/{id}/leave.
7. On end call POST /rtc/conversations/{id}/end.

## 6. Error Handling Rules for Flutter

- 401/403: force token refresh flow; if refresh fails, logout.
- For message upload, treat request as failed unless response contains message id.
- If socket emits error:message with RATE_LIMIT, show user throttle feedback.
- For DM send failures with blocked users, surface clear text that messaging is blocked.

## 7. Production and Environment Notes

Required env for calling:
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET
- LIVEKIT_URL or LIVEKIT_PUBLIC_URL

Recommended env for chat debugging:
- CHAT_DEBUG=1 (optional)

Storage behavior for chat attachments:
- Message upload stores media via NajimStorage and returns media_Url.
- For s3/minio mode, ensure endpoint and bucket are valid.

## 8. Known Caveats

1) Presence REST controller is currently commented out (not active).
   Use socket presence:update events instead.

2) Message text search dto currently expects UUID conversationId.
   Project uses CUID ids; avoid passing conversationId to search until this validation is updated.

3) uploads controller exists (/uploads) but chat UI should use /conversations/{id}/messages/upload for message-linked attachments.

## 9. Backend Source Map (for fast team cross-check)

- Conversations controller/service:
  - src/modules/chat/conversations/conversations.controller.ts
  - src/modules/chat/conversations/conversations.service.ts

- Messages controller/service:
  - src/modules/chat/messages/messages.controller.ts
  - src/modules/chat/messages/messages.service.ts

- Realtime gateway:
  - src/modules/chat/realtime/realtime.gateway.ts

- RTC controller/service:
  - src/modules/chat/rtc/rtc.controller.ts
  - src/modules/chat/rtc/rtc.service.ts

- User search/block:
  - src/modules/chat/users/users.controller.ts
  - src/modules/chat/users/users.service.ts

- Prisma chat/call models and enums:
  - prisma/schema.prisma
