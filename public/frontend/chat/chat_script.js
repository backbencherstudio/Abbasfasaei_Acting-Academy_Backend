// ============================================================
// Chat Tester - Enhanced Frontend
// ============================================================

const ORIGIN = (() => {
  const saved = localStorage.getItem('chat_backend_origin');
  if (saved) return saved.replace(/\/$/, '');
  return `${location.protocol}//${location.hostname}:7777`;
})();
const API = `${ORIGIN}/api`;
const WS_URL = `${ORIGIN}/ws`;

const $ = (id) => document.getElementById(id);

const authScreen = $('auth-screen');
const chatScreen = $('chat-screen');
const jwtTokenInput = $('jwt-token');
const connectBtn = $('connect-btn');
const authMsg = $('auth-msg');

const sidebar = $('sidebar');
const convList = $('conv-list');
const searchInput = $('search-input');
const searchResults = $('search-results');
const currentUserInfo = $('current-user-info');

const chatEmpty = $('chat-empty');
const chatActive = $('chat-active');
const chatTitle = $('chat-title');
const chatStatus = $('chat-status');
const chatAvatarBtn = $('btn-chat-profile');
const chatAvatarImg = $('chat-avatar-img');
const chatAvatarFallback = $('chat-avatar-fallback');
const messagesEl = $('messages');
const typingBar = $('typing-bar');
const typingText = $('typing-text');
const msgInput = $('msg-input');
const fileInput = $('file-input');
const attachPreview = $('attach-preview');
const btnMembers = $('btn-members');
const btnAudioCall = $('btn-audio-call');
const btnVideoCall = $('btn-video-call');
const callChip = $('call-chip');
const incomingCallBanner = $('incoming-call-banner');
const incomingCallTitle = $('incoming-call-title');
const incomingCallSubtitle = $('incoming-call-subtitle');
const btnDeclineCall = $('btn-decline-call');
const btnAcceptCall = $('btn-accept-call');
const callOverlay = $('call-overlay');
const callModeLabel = $('call-mode-label');
const callPeerTitle = $('call-peer-title');
const callRuntime = $('call-runtime');
const callEmptyState = $('call-empty-state');
const callStageStatus = $('call-stage-status');
const remoteGrid = $('remote-grid');
const localPreviewCard = $('local-preview-card');
const localVideo = $('local-video');
const callParticipantCount = $('call-participant-count');
const callConnectionState = $('call-connection-state');
const btnCloseCallPanel = $('btn-close-call-panel');
const btnToggleMic = $('btn-toggle-mic');
const btnToggleCam = $('btn-toggle-cam');
const btnToggleScreen = $('btn-toggle-screen');
const btnLeaveCall = $('btn-leave-call');
const btnEndCall = $('btn-end-call');

const logEntries = $('log-entries');
const modal = $('modal');
const modalTitle = $('modal-title');
const modalBody = $('modal-body');
const modalOk = $('modal-ok');
const modalCancel = $('modal-cancel');
const modalClose = $('modal-close');

let socket = null;
let userId = null;
let activeConvId = null;
let activeConvType = null;
let activeConversation = null;
let conversations = new Map();
let pendingFiles = [];
let typingTimer = null;
let searchTimer = null;
let searchRequestToken = 0;
let conversationsRefreshTimer = null;
const readState = new Map();
const profileState = {
  conversation: null,
  members: [],
  media: [],
  files: [],
  dmParticipant: null,
  blockStatus: null,
};
const rtcState = {
  pendingIncomingCall: null,
  activeCall: null,
  room: null,
  overlayVisible: false,
  timerId: null,
  remoteTracks: new Map(),
  currentScreenShareEnabled: false,
};

function log(type, text) {
  const ts = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.innerHTML = `<span class="log-ts">${ts}</span>${text}`;
  logEntries.prepend(div);
  while (logEntries.children.length > 200) logEntries.lastChild.remove();
}

$('btn-clear-log').onclick = () => {
  logEntries.innerHTML = '';
};

function token() {
  return localStorage.getItem('chat_token');
}

function authHeaders() {
  return {
    Authorization: `Bearer ${token()}`,
    'Content-Type': 'application/json',
  };
}

function authHeadersNoJson() {
  return {
    Authorization: `Bearer ${token()}`,
  };
}

async function apiError(res, fallback = 'Request failed') {
  try {
    const text = await res.text();
    const payload = JSON.parse(text);
    if (Array.isArray(payload.message)) {
      return payload.message.join(', ');
    }
    return payload.message || payload.error || fallback;
  } catch {
    return fallback;
  }
}

function initial(name) {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

function showAuthMsg(text, type = 'error') {
  authMsg.textContent = text;
  authMsg.className = `auth-msg ${type}`;
  authMsg.classList.remove('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getConversationTitle(conv) {
  if (!conv) return 'Chat';
  if (conv.type === 'GROUP') return conv.title || 'Group';
  return (
    conv.participant?.name || conv.participant?.username || 'Direct Message'
  );
}

function getConversationSubtitle(conv) {
  if (!conv) return '';
  if (conv.type === 'GROUP') return `${conv.total_members || 0} members`;
  return conv.participant?.username || conv.participant?.id || 'Direct Message';
}

function getConversationAvatar(conv) {
  if (!conv) return null;
  return conv.avatar || conv.participant?.avatar || null;
}

function getMessagePreview(msg) {
  if (!msg) return '(no messages)';
  if (msg.content?.text) return msg.content.text;
  if (msg.attachments?.length)
    return `Attachment${msg.attachments.length > 1 ? 's' : ''}`;
  return '(no messages)';
}

function getStatusIcon(status) {
  if (status === 'READ') return '✓✓';
  if (status === 'DELIVERED') return '✓✓';
  return '✓';
}

function scheduleConversationsRefresh(delay = 250) {
  clearTimeout(conversationsRefreshTimer);
  conversationsRefreshTimer = setTimeout(() => {
    loadConversations();
  }, delay);
}

function renderConversationList() {
  const list = Array.from(conversations.values()).sort((a, b) => {
    const aTime = new Date(
      a.updated_at || a.last_message?.created_at || 0,
    ).getTime();
    const bTime = new Date(
      b.updated_at || b.last_message?.created_at || 0,
    ).getTime();
    return bTime - aTime;
  });

  convList.innerHTML = '';

  list.forEach((conv) => {
    const li = document.createElement('li');
    li.className = `conv-item${conv.id === activeConvId ? ' active' : ''}`;
    li.dataset.id = conv.id;

    const title = getConversationTitle(conv);
    const preview = getMessagePreview(conv.last_message);
    const unread = conv.unread_messages || 0;
    const avatar = getConversationAvatar(conv);

    li.innerHTML = `
      ${
        avatar
          ? `<img class="conv-avatar" src="${avatar}" alt="${escapeHtml(title)}" />`
          : `<div class="conv-avatar">${initial(title)}</div>`
      }
      <div class="conv-meta">
        <span class="conv-name">${escapeHtml(title)}</span>
        <span class="conv-preview">${escapeHtml(preview)}</span>
      </div>
      ${unread > 0 ? `<span class="conv-badge">${unread}</span>` : ''}
    `;

    li.onclick = () => selectConversation(conv.id);
    convList.appendChild(li);
  });
}

function renderChatHeader() {
  const conv = activeConversation;
  if (!conv) return;

  const title = getConversationTitle(conv);
  const subtitle = getConversationSubtitle(conv);
  const avatar = getConversationAvatar(conv);

  chatTitle.textContent = title;
  chatStatus.textContent = subtitle;
  btnMembers.classList.toggle('hidden', conv.type !== 'GROUP');
  btnAudioCall.classList.remove('hidden');
  btnVideoCall.classList.remove('hidden');

  if (avatar) {
    chatAvatarImg.src = avatar;
    chatAvatarImg.classList.remove('hidden');
    chatAvatarFallback.classList.add('hidden');
  } else {
    chatAvatarImg.removeAttribute('src');
    chatAvatarImg.classList.add('hidden');
    chatAvatarFallback.textContent = initial(title);
    chatAvatarFallback.classList.remove('hidden');
  }

  updateCallHeaderState();
}

async function loadConversations() {
  try {
    log('api', 'GET /conversations');
    const res = await fetch(`${API}/conversations`, {
      headers: authHeadersNoJson(),
    });
    if (!res.ok) throw new Error(await apiError(res));

    const json = await res.json();
    const list = json.data || json.items || [];
    const updatedMap = new Map();
    list.forEach((conv) => updatedMap.set(conv.id, conv));
    conversations = updatedMap;

    if (activeConvId && conversations.has(activeConvId)) {
      activeConversation = conversations.get(activeConvId);
      activeConvType = activeConversation.type;
      renderChatHeader();
    }

    renderConversationList();
    log('api', `→ ${list.length} conversations loaded`);
  } catch (error) {
    log('error', `loadConversations: ${error.message}`);
  }
}

function createMessageElement(msg) {
  const isMe = msg.sender?.id === userId;
  const div = document.createElement('div');
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  div.dataset.id = msg.id;

  const text = msg.content?.text || '';
  const senderName = msg.sender?.name || msg.sender?.id?.slice(0, 8) || '?';
  const time = formatTime(msg.created_at);
  const statusClass = msg.status === 'READ' ? 'read' : '';

  let html = '<div class="msg-bubble">';

  if (msg.reply_to) {
    const replyText = msg.reply_to.content?.text || '(attachment)';
    html += `<div class="msg-reply">↩ ${escapeHtml(replyText)}</div>`;
  }

  if (!isMe && activeConvType === 'GROUP') {
    html += `<div class="msg-sender">${escapeHtml(senderName)}</div>`;
  }

  if (text) {
    html += `<p class="msg-text">${escapeHtml(text)}</p>`;
  }

  if (msg.attachments?.length) {
    msg.attachments.forEach((att) => {
      const url = att.file_path || '';
      if (att.type === 'IMAGE' || att.mime_type?.startsWith('image')) {
        html += `<div class="msg-attachment"><img src="${url}" alt="${escapeHtml(att.file_name || 'image')}" loading="lazy" /></div>`;
      } else if (att.type === 'VIDEO' || att.mime_type?.startsWith('video')) {
        html += `<div class="msg-attachment"><video src="${url}" controls></video></div>`;
      } else {
        html += `<div class="msg-attachment"><a href="${url}" target="_blank">📎 ${escapeHtml(att.file_name || 'File')}</a></div>`;
      }
    });
  }

  html += `<span class="msg-time">${time}`;
  if (isMe) {
    html += ` <span class="msg-status ${statusClass}" data-status-for="${msg.id}">${getStatusIcon(msg.status || 'SENT')}</span>`;
  }
  html += '</span></div>';

  div.innerHTML = html;
  return div;
}

function appendMessage(msg) {
  if (!msg?.id) return;
  if (messagesEl.querySelector(`[data-id="${msg.id}"]`)) {
    updateOwnedMessageStatuses([msg.id], msg.status || 'SENT');
    return;
  }

  messagesEl.appendChild(createMessageElement(msg));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateOwnedMessageStatuses(messageIds, status) {
  if (!Array.isArray(messageIds)) return;
  messageIds.forEach((messageId) => {
    const el = messagesEl.querySelector(`[data-status-for="${messageId}"]`);
    if (!el) return;
    el.textContent = getStatusIcon(status);
    el.classList.toggle('read', status === 'READ');
  });

  if (
    activeConversation?.last_message?.id &&
    messageIds.includes(activeConversation.last_message.id) &&
    activeConversation.last_message.is_me
  ) {
    activeConversation.last_message.status = status;
  }
}

function updateConversationFromMessage(msg) {
  if (!msg?.conversation_id) return;
  const conv = conversations.get(msg.conversation_id);
  if (!conv) {
    scheduleConversationsRefresh();
    return;
  }

  const isMine = msg.sender?.id === userId;
  conv.last_message = {
    id: msg.id,
    content: msg.content,
    attachments: msg.attachments || [],
    sender: msg.sender,
    created_at: msg.created_at,
    is_me: isMine,
    status: msg.status || 'SENT',
  };
  conv.updated_at = msg.created_at;

  if (msg.conversation_id === activeConvId) {
    conv.unread_messages = 0;
  } else if (!isMine) {
    conv.unread_messages = (conv.unread_messages || 0) + 1;
  }

  conversations.set(conv.id, conv);
  if (activeConvId === conv.id) {
    activeConversation = conv;
    renderChatHeader();
  }
  renderConversationList();
}

async function loadMessages(convId) {
  try {
    log('api', `GET /conversations/${convId.slice(0, 8)}/messages`);
    const res = await fetch(`${API}/conversations/${convId}/messages`, {
      headers: authHeadersNoJson(),
    });
    if (!res.ok) throw new Error(await apiError(res));

    const json = await res.json();
    const msgs = json.data || json.items || [];
    const ordered = [...msgs].reverse();

    messagesEl.innerHTML = '';
    ordered.forEach((msg) => appendMessage(msg));
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const lastIncoming = msgs.find((m) => m.sender?.id !== userId);
    if (lastIncoming?.id) {
      await markAsRead(convId, lastIncoming.id, lastIncoming.created_at);
    }
  } catch (error) {
    log('error', `loadMessages: ${error.message}`);
  }
}

async function selectConversation(convId) {
  const conv = conversations.get(convId);
  if (!conv) {
    scheduleConversationsRefresh();
    return;
  }

  activeConvId = convId;
  activeConvType = conv.type;
  activeConversation = conv;

  chatEmpty.classList.add('hidden');
  chatActive.classList.remove('hidden');
  pendingFiles = [];
  renderAttachPreview();
  renderChatHeader();
  renderConversationList();

  if (socket) {
    socket.emit('conversation:join', { conversation_id: convId });
    log('socket', `EMIT conversation:join — ${convId.slice(0, 8)}`);
  }

  await loadMessages(convId);
  await refreshCallState(convId);

  const current = conversations.get(convId);
  if (current) {
    current.unread_messages = 0;
    conversations.set(convId, current);
    activeConversation = current;
    renderConversationList();
  }

  if (window.innerWidth <= 768) {
    sidebar.classList.add('hidden-mobile');
  }
}

async function markAsRead(convId, messageId, at) {
  const existing = readState.get(convId);
  if (existing === messageId) return;
  readState.set(convId, messageId);

  try {
    log(
      'api',
      `PATCH /conversations/${convId.slice(0, 8)}/read — up_to=${messageId.slice(0, 8)}`,
    );
    const res = await fetch(`${API}/conversations/${convId}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ up_to_message_id: messageId }),
    });
    if (!res.ok) throw new Error(await apiError(res));

    if (socket?.connected) {
      socket.emit('message:read', {
        conversation_id: convId,
        at: at ? new Date(at).toISOString() : new Date().toISOString(),
      });
      log('socket', `EMIT message:read — conv=${convId.slice(0, 8)}`);
    }

    const conv = conversations.get(convId);
    if (conv) {
      conv.unread_messages = 0;
      conversations.set(convId, conv);
      renderConversationList();
    }
  } catch (error) {
    log('error', `markAsRead: ${error.message}`);
  }
}

function connectSocket() {
  if (socket?.connected) return;
  const tk = token();
  if (!tk) return;

  socket = io(WS_URL, {
    auth: { token: tk },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    timeout: 12000,
  });

  socket.on('connect', () => {
    log('socket', `Connected (${socket.id})`);
    if (activeConvId) {
      socket.emit('conversation:join', { conversation_id: activeConvId });
    }
  });

  socket.on('connection:ok', (d) => {
    log('socket', `connection:ok — user_id=${d.user_id}`);
  });

  socket.on('connection:error', (d) => {
    log('error', `connection:error — ${d.message}`);
    socket.disconnect();
  });

  socket.on('connect_error', (e) => {
    log('error', `connect_error: ${e.message}`);
  });

  socket.on('disconnect', (reason) => {
    log('socket', `Disconnected: ${reason}`);
  });

  socket.on('message:new', async (msg) => {
    log(
      'socket',
      `message:new — conv=${msg.conversation_id}, from=${msg.sender?.id?.slice(0, 8)}`,
    );
    updateConversationFromMessage(msg);

    if (msg.conversation_id === activeConvId) {
      appendMessage(msg);
      if (msg.sender?.id !== userId) {
        await markAsRead(activeConvId, msg.id, msg.created_at);
      }
    }
  });

  socket.on('message:status', (d) => {
    log(
      'socket',
      `message:status — status=${d.status}, count=${d.message_ids?.length || 0}`,
    );
    updateOwnedMessageStatuses(d.message_ids || [], d.status);
    if (d.conversation_id && conversations.has(d.conversation_id)) {
      const conv = conversations.get(d.conversation_id);
      if (
        conv?.last_message?.is_me &&
        d.message_ids?.includes(conv.last_message.id)
      ) {
        conv.last_message.status = d.status;
        conversations.set(conv.id, conv);
        renderConversationList();
      }
    }
  });

  socket.on('message:read', (d) => {
    log(
      'socket',
      `message:read — user=${d.user_id?.slice(0, 8)}, conv=${d.conversation_id?.slice(0, 8)}`,
    );
    if (d.conversation_id === activeConvId) {
      scheduleConversationsRefresh(100);
    }
  });

  socket.on('typing', (d) => {
    if (d.user_id === userId || d.conversation_id !== activeConvId) return;
    typingText.textContent = `${d.user_name || 'Someone'} is typing...`;
    typingBar.classList.toggle('hidden', !d.on);
    clearTimeout(typingTimer);
    if (d.on) {
      typingTimer = setTimeout(() => typingBar.classList.add('hidden'), 3000);
    }
  });

  socket.on('presence:update', (d) => {
    log(
      'socket',
      `presence — ${d.user_id?.slice(0, 8)} ${d.online ? 'online' : 'offline'}`,
    );
  });

  socket.on('call:incoming', (d) => {
    log(
      'socket',
      `call:incoming — conv=${d.conversation_id?.slice(0, 8)}, by=${d.started_by?.slice(0, 8)}`,
    );
    handleIncomingCall(d);
  });

  socket.on('call:participant_joined', (d) => {
    log(
      'socket',
      `call:participant_joined — conv=${d.conversation_id?.slice(0, 8)}, user=${d.user?.id?.slice(0, 8)}`,
    );
    handleParticipantJoined(d);
  });

  socket.on('call:participant_left', (d) => {
    log(
      'socket',
      `call:participant_left — conv=${d.conversation_id?.slice(0, 8)}, user=${d.user_id?.slice(0, 8)}`,
    );
    handleParticipantLeft(d);
  });

  socket.on('call:participant_updated', (d) => {
    log(
      'socket',
      `call:participant_updated — conv=${d.conversation_id?.slice(0, 8)}, user=${d.participant?.user_id?.slice(0, 8)}`,
    );
    handleParticipantUpdated(d);
  });

  socket.on('call:declined', (d) => {
    log(
      'socket',
      `call:declined — conv=${d.conversation_id?.slice(0, 8)}, user=${d.user_id?.slice(0, 8)}`,
    );
    if (activeConvId === d.conversation_id && rtcState.activeCall) {
      callStageStatus.textContent = 'A participant declined the call.';
    }
  });

  socket.on('call:ended', (d) => {
    log(
      'socket',
      `call:ended — conv=${d.conversation_id?.slice(0, 8)}, by=${d.by_user_id?.slice(0, 8)}`,
    );
    handleCallEnded(d);
  });
}

connectBtn.onclick = () => {
  const tokenVal = jwtTokenInput.value.trim();
  if (!tokenVal) {
    showAuthMsg('JWT token is required');
    return;
  }

  localStorage.setItem('chat_token', tokenVal);
  try {
    const decoded = JSON.parse(atob(tokenVal.split('.')[1]));
    userId = decoded.sub || decoded.userId;
    enterChat();
  } catch {
    showAuthMsg('Invalid JWT token format');
  }
};

$('btn-logout').onclick = () => {
  disconnectLivekitRoom(false);
  if (socket) socket.disconnect();
  localStorage.removeItem('chat_token');
  userId = null;
  activeConvId = null;
  activeConversation = null;
  conversations.clear();
  chatScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  log('info', 'Logged out');
};

function enterChat() {
  authScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  currentUserInfo.textContent = `ID: ${userId?.slice(0, 8)}...`;
  loadConversations();
  connectSocket();
}

$('btn-send').onclick = () => sendMessage();
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

msgInput.addEventListener('input', () => {
  if (!socket || !activeConvId) return;
  socket.emit('typing', { conversation_id: activeConvId, on: true });
});

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!activeConvId) {
    log('error', 'No conversation selected');
    return;
  }
  if (!text && !pendingFiles.length) return;

  const formData = new FormData();
  if (text) {
    formData.append('content', JSON.stringify({ text }));
  }
  formData.append(
    'kind',
    pendingFiles.length ? inferKind(pendingFiles[0]) : 'TEXT',
  );
  pendingFiles.forEach((file) => formData.append('attachments', file));

  msgInput.value = '';
  pendingFiles = [];
  renderAttachPreview();

  try {
    log('api', `POST /conversations/${activeConvId.slice(0, 8)}/messages`);
    const res = await fetch(`${API}/conversations/${activeConvId}/messages`, {
      method: 'POST',
      headers: authHeadersNoJson(),
      body: formData,
    });
    if (!res.ok) throw new Error(await apiError(res, 'Send failed'));

    const json = await res.json();
    if (json.data) {
      appendMessage(json.data);
      updateConversationFromMessage(json.data);
    }
    if (socket) {
      socket.emit('typing', { conversation_id: activeConvId, on: false });
    }
  } catch (error) {
    log('error', `sendMessage: ${error.message}`);
  }
}

function inferKind(file) {
  if (file?.type?.startsWith('image/')) return 'IMAGE';
  if (file?.type?.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}

$('btn-attach').onclick = () => {
  if (!activeConvId) {
    log('error', 'Select a conversation first');
    return;
  }
  fileInput.click();
};

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  files.forEach((file) => pendingFiles.push(file));
  fileInput.value = '';
  renderAttachPreview();
});

function renderAttachPreview() {
  if (!pendingFiles.length) {
    attachPreview.classList.add('hidden');
    attachPreview.innerHTML = '';
    return;
  }

  attachPreview.classList.remove('hidden');
  attachPreview.innerHTML = pendingFiles
    .map((file, index) => {
      const isImg = file.type?.startsWith('image/');
      const preview = isImg ? URL.createObjectURL(file) : '';
      return `
        <div class="attach-thumb">
          ${
            isImg
              ? `<img src="${preview}" alt="${escapeHtml(file.name)}" />`
              : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:.6rem;color:#888;">${escapeHtml(file.name.split('.').pop()?.toUpperCase() || 'FILE')}</div>`
          }
          <button class="remove" data-idx="${index}">&times;</button>
        </div>
      `;
    })
    .join('');
}

attachPreview.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove');
  if (!btn) return;
  pendingFiles.splice(Number(btn.dataset.idx), 1);
  renderAttachPreview();
});

async function discoverUsers(query = '') {
  const qs = query ? `?search=${encodeURIComponent(query)}` : '';
  const res = await fetch(`${API}/users/discover${qs}`, {
    headers: authHeadersNoJson(),
  });
  if (!res.ok) {
    throw new Error(await apiError(res, 'Discover failed'));
  }
  const json = await res.json();
  return json.data || [];
}

function renderSearchResults(users) {
  if (!users.length) {
    searchResults.innerHTML =
      '<div class="search-item" style="color:#888;cursor:default;">No users found</div>';
    searchResults.classList.remove('hidden');
    return;
  }

  searchResults.innerHTML = users
    .map((user) => {
      const title = user.name || user.username || 'User';
      return `
        <div class="search-item" data-uid="${user.id}">
          ${
            user.avatar
              ? `<img class="conv-avatar" src="${user.avatar}" alt="${escapeHtml(title)}" />`
              : `<div class="conv-avatar">${initial(title)}</div>`
          }
          <div>
            <div class="name">${escapeHtml(title)}</div>
            <div class="sub">${escapeHtml(user.username || '')}</div>
          </div>
        </div>
      `;
    })
    .join('');
  searchResults.classList.remove('hidden');
}

async function openDiscoverResults(query = '') {
  const requestId = ++searchRequestToken;
  try {
    log('api', `GET /users/discover${query ? `?search=${query}` : ''}`);
    const users = await discoverUsers(query);
    if (requestId !== searchRequestToken) return;
    renderSearchResults(users.filter((u) => u.id !== userId));
  } catch (error) {
    if (requestId !== searchRequestToken) return;
    log('error', `discover: ${error.message}`);
    searchResults.innerHTML =
      '<div class="search-item" style="color:#f87171;cursor:default;">Error fetching users</div>';
    searchResults.classList.remove('hidden');
  }
}

searchInput.addEventListener('focus', () => {
  openDiscoverResults(searchInput.value.trim());
});

searchInput.addEventListener('click', () => {
  openDiscoverResults(searchInput.value.trim());
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  searchTimer = setTimeout(() => {
    openDiscoverResults(q);
  }, 220);
});

searchResults.addEventListener('click', async (e) => {
  const item = e.target.closest('.search-item[data-uid]');
  if (!item) return;

  const uid = item.dataset.uid;
  const name = item.querySelector('.name')?.textContent || 'Direct Message';
  searchResults.classList.add('hidden');
  searchInput.value = '';

  try {
    log('api', `POST /conversations — DM with ${uid.slice(0, 8)}`);
    const res = await fetch(`${API}/conversations`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ type: 'DM', participant_id: uid }),
    });
    if (!res.ok) throw new Error(await apiError(res));
    const json = await res.json();
    await loadConversations();
    if (json.data?.id) {
      await selectConversation(json.data.id);
      chatTitle.textContent = name;
    }
  } catch (error) {
    log('error', `createDM: ${error.message}`);
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.sidebar-search')) {
    searchResults.classList.add('hidden');
  }
});

function closeModal() {
  modal.classList.add('hidden');
  modalTitle.textContent = 'Modal';
  modalBody.innerHTML = '';
  modalOk.onclick = null;
  modalCancel.onclick = null;
  modalClose.onclick = null;
}

modalClose.onclick = closeModal;

function showCloseOnlyModal(title, bodyHtml) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modalOk.textContent = 'Close';
  modalCancel.classList.add('hidden');
  modal.classList.remove('hidden');
  modalOk.onclick = closeModal;
  modalClose.onclick = closeModal;
}

function escapeAttr(value) {
  return escapeHtml(value || '').replace(/"/g, '&quot;');
}

async function openGroupUserPicker(mode, existingIds = []) {
  return new Promise((resolve) => {
    const selected = [];
    modalTitle.textContent = mode === 'create' ? 'Create Group' : 'Add Members';
    modalCancel.classList.remove('hidden');
    modalOk.textContent = mode === 'create' ? 'Create' : 'Add';
    modal.classList.remove('hidden');

    modalBody.innerHTML = `
      ${
        mode === 'create'
          ? '<input id="group-title-input" type="text" placeholder="Group title" />'
          : ''
      }
      <input id="group-search-input" type="text" placeholder="Search users..." />
      <div id="group-selected" style="margin:6px 0;display:flex;flex-wrap:wrap;gap:4px;"></div>
      <div id="group-results"></div>
    `;

    const titleInput = $('group-title-input');
    const groupSearch = $('group-search-input');
    const groupSelected = $('group-selected');
    const groupResults = $('group-results');
    const excluded = new Set([userId, ...existingIds]);
    let localTimer = null;

    function renderSelected() {
      groupSelected.innerHTML = selected
        .map(
          (user, index) =>
            `<span class="modal-user-chip">${escapeHtml(user.name)} <span class="x" data-idx="${index}">&times;</span></span>`,
        )
        .join('');
    }

    async function renderLocalResults(query = '') {
      try {
        const users = await discoverUsers(query);
        const filtered = users.filter(
          (user) =>
            user.id !== userId &&
            !excluded.has(user.id) &&
            !selected.find((item) => item.id === user.id),
        );

        if (!filtered.length) {
          groupResults.innerHTML =
            '<div class="empty-state">No users found.</div>';
          return;
        }

        groupResults.innerHTML = filtered
          .map((user) => {
            const name = user.name || user.username || 'User';
            return `
              <div class="modal-result-item" data-uid="${user.id}" data-name="${escapeAttr(name)}">
                ${
                  user.avatar
                    ? `<img class="conv-avatar" src="${user.avatar}" alt="${escapeHtml(name)}" style="width:28px;height:28px;" />`
                    : `<div class="conv-avatar" style="width:28px;height:28px;font-size:.7rem;">${initial(name)}</div>`
                }
                <div>
                  <div style="font-size:.82rem;">${escapeHtml(name)}</div>
                  <div style="font-size:.72rem;color:#888;">${escapeHtml(user.username || '')}</div>
                </div>
              </div>
            `;
          })
          .join('');
      } catch (error) {
        groupResults.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Search failed')}</div>`;
      }
    }

    groupSelected.onclick = (event) => {
      const x = event.target.closest('.x');
      if (!x) return;
      selected.splice(Number(x.dataset.idx), 1);
      renderSelected();
      renderLocalResults(groupSearch.value.trim());
    };

    groupResults.onclick = (event) => {
      const item = event.target.closest('.modal-result-item[data-uid]');
      if (!item) return;
      selected.push({
        id: item.dataset.uid,
        name: item.dataset.name || 'User',
      });
      renderSelected();
      renderLocalResults(groupSearch.value.trim());
    };

    groupSearch.onfocus = () => renderLocalResults(groupSearch.value.trim());
    groupSearch.oninput = () => {
      clearTimeout(localTimer);
      localTimer = setTimeout(() => {
        renderLocalResults(groupSearch.value.trim());
      }, 220);
    };

    modalCancel.onclick = () => {
      closeModal();
      resolve(null);
    };
    modalClose.onclick = () => {
      closeModal();
      resolve(null);
    };
    modalOk.onclick = () => {
      if (mode === 'create') {
        const title = titleInput?.value?.trim();
        if (!title) {
          titleInput.style.borderColor = '#f87171';
          return;
        }
        if (!selected.length) return;
        closeModal();
        resolve({ title, ids: selected.map((item) => item.id) });
        return;
      }

      if (!selected.length) return;
      closeModal();
      resolve({ ids: selected.map((item) => item.id) });
    };
  });
}

$('btn-new-dm').onclick = () => {
  searchInput.focus();
  openDiscoverResults(searchInput.value.trim());
};

$('btn-new-group').onclick = async () => {
  const result = await openGroupUserPicker('create');
  if (!result) return;

  try {
    const res = await fetch(`${API}/conversations`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        type: 'GROUP',
        title: result.title,
        participant_ids: result.ids,
      }),
    });
    if (!res.ok) throw new Error(await apiError(res));
    const json = await res.json();
    await loadConversations();
    if (json.data?.id) {
      await selectConversation(json.data.id);
    }
  } catch (error) {
    log('error', `createGroup: ${error.message}`);
  }
};

async function fetchConversationAttachments(convId, type) {
  const suffix = type ? `?type=${encodeURIComponent(type)}` : '';
  const res = await fetch(
    `${API}/conversations/${convId}/attachments${suffix}`,
    {
      headers: authHeadersNoJson(),
    },
  );
  if (!res.ok) throw new Error(await apiError(res));
  const json = await res.json();
  return json.data || [];
}

async function fetchConversationMembers(convId) {
  const res = await fetch(`${API}/conversations/${convId}/members`, {
    headers: authHeadersNoJson(),
  });
  if (!res.ok) throw new Error(await apiError(res));
  const json = await res.json();
  return json.data || [];
}

async function fetchBlockStatus(targetUserId) {
  const res = await fetch(`${API}/users/${targetUserId}/block-status`, {
    headers: authHeadersNoJson(),
  });
  if (!res.ok) throw new Error(await apiError(res));
  const json = await res.json();
  return json.data || { blocked_by_me: false, blocked_me: false };
}

function renderProfileModal() {
  const conv = profileState.conversation;
  if (!conv) return;

  const title = getConversationTitle(conv);
  const subtitle = getConversationSubtitle(conv);
  const avatar = getConversationAvatar(conv);
  const participant = profileState.dmParticipant;
  const blockLabel = profileState.blockStatus?.blocked_by_me
    ? 'Unblock User'
    : 'Block User';

  let bodyHtml = `
    <div class="profile-head">
      ${
        avatar
          ? `<img src="${avatar}" alt="${escapeHtml(title)}" />`
          : `<div class="conv-avatar">${initial(title)}</div>`
      }
      <div>
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(subtitle)}</p>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Actions</div>
      <div class="modal-actions-grid">
        <button class="modal-action-btn" data-action="refresh-profile">Refresh</button>
        <button class="modal-action-btn danger" data-action="delete-conversation">Delete Conversation</button>
        <button class="modal-action-btn" data-action="view-media">View Media & Files</button>
  `;

  if (conv.type === 'DM' && participant?.id) {
    bodyHtml += `
        <button class="modal-action-btn" data-action="toggle-block">${escapeHtml(blockLabel)}</button>
        <button class="modal-action-btn" data-action="report-user">Report User</button>
    `;
  }

  if (conv.type === 'GROUP') {
    bodyHtml += `
        <button class="modal-action-btn" data-action="add-members">Add Members</button>
      `;
  }

  bodyHtml += `
      </div>
    </div>
    <div class="modal-section" id="media-files-section">
      <div class="modal-section-title">Media</div>
      <div class="attachments-grid">
  `;

  if (profileState.media.length) {
    bodyHtml += profileState.media
      .map((item) => {
        if (item.type === 'VIDEO' || item.mime_type?.startsWith('video')) {
          return `<div class="attachment-card"><video src="${item.file_path}" controls></video></div>`;
        }
        return `<div class="attachment-card"><img src="${item.file_path}" alt="${escapeHtml(item.file_name || 'media')}" /></div>`;
      })
      .join('');
  } else {
    bodyHtml += '<div class="empty-state">No media yet.</div>';
  }

  bodyHtml += `
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Files</div>
  `;

  if (profileState.files.length) {
    bodyHtml += profileState.files
      .map(
        (item) => `
          <div class="attachment-card">
            <a href="${item.file_path}" target="_blank">${escapeHtml(item.file_name || 'File')}</a>
          </div>
        `,
      )
      .join('');
  } else {
    bodyHtml += '<div class="empty-state">No files yet.</div>';
  }

  bodyHtml += '</div>';

  if (conv.type === 'GROUP') {
    bodyHtml += `
      <div class="modal-section">
        <div class="modal-section-title">Members</div>
    `;

    if (profileState.members.length) {
      bodyHtml += profileState.members
        .map((member) => {
          const canRemove = !member.is_me;
          return `
            <div class="member-row">
              <div class="member-row-main">
                ${
                  member.avatar
                    ? `<img class="conv-avatar" src="${member.avatar}" alt="${escapeHtml(member.name || 'member')}" style="width:32px;height:32px;" />`
                    : `<div class="conv-avatar" style="width:32px;height:32px;font-size:.75rem;">${initial(member.name || member.username)}</div>`
                }
                <div class="member-row-meta">
                  <div class="name">${escapeHtml(member.name || member.username || 'Unknown')}</div>
                  <div class="sub">${escapeHtml(member.role)}${member.is_me ? ' (You)' : ''}</div>
                </div>
              </div>
              ${
                canRemove
                  ? `<button class="member-row-action" data-action="remove-member" data-member-id="${member.member_id}">Remove</button>`
                  : ''
              }
            </div>
          `;
        })
        .join('');
    } else {
      bodyHtml += '<div class="empty-state">No members found.</div>';
    }

    bodyHtml += '</div>';
  }

  showCloseOnlyModal('Conversation Details', bodyHtml);
}

async function openConversationProfile() {
  if (!activeConversation) return;
  profileState.conversation = activeConversation;
  profileState.members = [];
  profileState.media = [];
  profileState.files = [];
  profileState.dmParticipant = activeConversation.participant || null;
  profileState.blockStatus = null;

  showCloseOnlyModal(
    'Conversation Details',
    '<div class="empty-state">Loading conversation details...</div>',
  );

  try {
    const requests = [
      fetchConversationAttachments(activeConversation.id, 'media'),
      fetchConversationAttachments(activeConversation.id, 'file'),
    ];

    if (activeConversation.type === 'GROUP') {
      requests.push(fetchConversationMembers(activeConversation.id));
    } else if (activeConversation.participant?.id) {
      requests.push(fetchBlockStatus(activeConversation.participant.id));
    }

    const results = await Promise.all(requests);
    profileState.media = results[0] || [];
    profileState.files = results[1] || [];

    if (activeConversation.type === 'GROUP') {
      profileState.members = results[2] || [];
    } else {
      profileState.blockStatus = results[2] || null;
    }

    renderProfileModal();
  } catch (error) {
    showCloseOnlyModal(
      'Conversation Details',
      `<div class="empty-state">${escapeHtml(error.message || 'Failed to load details')}</div>`,
    );
  }
}

chatAvatarBtn.onclick = () => openConversationProfile();
btnMembers.onclick = () => openConversationProfile();

modalBody.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-action]');
  if (!btn || !profileState.conversation) return;

  const action = btn.dataset.action;
  const conv = profileState.conversation;

  try {
    if (action === 'refresh-profile') {
      await openConversationProfile();
      return;
    }

    if (action === 'view-media') {
      modalBody.querySelector('#media-files-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      return;
    }

    if (action === 'delete-conversation') {
      if (!confirm('Delete this conversation permanently?')) return;
      const res = await fetch(`${API}/conversations/${conv.id}`, {
        method: 'DELETE',
        headers: authHeadersNoJson(),
      });
      if (!res.ok) throw new Error(await apiError(res));

      closeModal();
      if (activeConvId === conv.id) {
        activeConvId = null;
        activeConvType = null;
        activeConversation = null;
        chatActive.classList.add('hidden');
        chatEmpty.classList.remove('hidden');
        messagesEl.innerHTML = '';
      }
      await loadConversations();
      return;
    }

    if (action === 'report-user') {
      const targetUserId = profileState.dmParticipant?.id;
      if (!targetUserId) return;
      const reason =
        window.prompt('Write a report reason (optional):', '') || '';
      const res = await fetch(`${API}/conversations/report/${targetUserId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(await apiError(res));
      alert('User reported successfully.');
      return;
    }

    if (action === 'toggle-block') {
      const targetUserId = profileState.dmParticipant?.id;
      if (!targetUserId) return;
      const blocked = Boolean(profileState.blockStatus?.blocked_by_me);
      const res = await fetch(`${API}/users/${targetUserId}/block`, {
        method: blocked ? 'DELETE' : 'POST',
        headers: authHeadersNoJson(),
      });
      if (!res.ok) throw new Error(await apiError(res));
      profileState.blockStatus = await fetchBlockStatus(targetUserId);
      renderProfileModal();
      return;
    }

    if (action === 'add-members') {
      const existingIds = profileState.members.map((member) => member.user_id);
      const result = await openGroupUserPicker('add', existingIds);
      if (!result) return;

      const res = await fetch(`${API}/conversations/${conv.id}/members`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ member_ids: result.ids }),
      });
      if (!res.ok) throw new Error(await apiError(res));
      await loadConversations();
      await openConversationProfile();
      return;
    }

    if (action === 'remove-member') {
      const memberId = btn.dataset.memberId;
      if (!memberId) return;
      if (!confirm('Remove this member from the group?')) return;
      const res = await fetch(
        `${API}/conversations/${conv.id}/members/${memberId}`,
        {
          method: 'DELETE',
          headers: authHeadersNoJson(),
        },
      );
      if (!res.ok) throw new Error(await apiError(res));
      await loadConversations();
      await openConversationProfile();
    }
  } catch (error) {
    alert(error.message || 'Action failed');
  }
});

function getLivekitSdk() {
  return (
    window.livekitClient ||
    window.LivekitClient ||
    window.LiveKitClient ||
    window.livekit ||
    null
  );
}

function getCallTitle(call) {
  if (call?.conversation?.title) return call.conversation.title;
  if (activeConversation?.type === 'DM') {
    return (
      activeConversation?.participant?.name ||
      activeConversation?.participant?.username ||
      'Direct Call'
    );
  }
  return getConversationTitle(activeConversation) || 'Call';
}

function formatDuration(ms) {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function stopCallTimer() {
  if (rtcState.timerId) {
    clearInterval(rtcState.timerId);
    rtcState.timerId = null;
  }
}

function startCallTimer(startAt) {
  stopCallTimer();
  if (!startAt) {
    callRuntime.textContent = '00:00';
    return;
  }
  const started = new Date(startAt).getTime();
  const update = () => {
    callRuntime.textContent = formatDuration(Date.now() - started);
  };
  update();
  rtcState.timerId = setInterval(update, 1000);
}

function setCallConnectionLabel(text) {
  callConnectionState.textContent = text;
}

function updateCallHeaderState() {
  const currentCall =
    rtcState.activeCall && rtcState.activeCall.conversation_id === activeConvId
      ? rtcState.activeCall
      : null;

  if (!activeConversation) {
    callChip.classList.add('hidden');
    btnAudioCall.classList.add('hidden');
    btnVideoCall.classList.add('hidden');
    return;
  }

  btnAudioCall.classList.remove('hidden');
  btnVideoCall.classList.remove('hidden');

  if (!currentCall) {
    callChip.classList.add('hidden');
    btnAudioCall.title = 'Start audio call';
    btnVideoCall.title = 'Start video call';
    return;
  }

  callChip.classList.remove('hidden');
  const label = rtcState.room
    ? `In ${currentCall.kind.toLowerCase()} call`
    : `Active ${currentCall.kind.toLowerCase()} call`;
  callChip.textContent = `${label} • ${currentCall.participant_count || 0}`;
  btnAudioCall.title = 'Join active call';
  btnVideoCall.title = 'Join active call';
}

function showIncomingCall(call) {
  rtcState.pendingIncomingCall = call;
  incomingCallTitle.textContent =
    call.caller?.name || call.conversation_title || 'Incoming call';
  incomingCallSubtitle.textContent = `${(call.kind || 'VIDEO').toLowerCase()} call`;
  incomingCallBanner.classList.remove('hidden');
}

function hideIncomingCall() {
  rtcState.pendingIncomingCall = null;
  incomingCallBanner.classList.add('hidden');
}

function resetCallOverlayUi() {
  callEmptyState.classList.remove('hidden');
  remoteGrid.classList.add('hidden');
  remoteGrid.innerHTML = '';
  localPreviewCard.classList.add('hidden');
  if (localVideo) {
    try {
      localVideo.srcObject = null;
    } catch {}
  }
  callStageStatus.textContent = 'Waiting for participants...';
  callParticipantCount.textContent = '0 participants';
  setCallConnectionLabel('Not connected');
  btnToggleMic.textContent = 'Mute';
  btnToggleCam.textContent = 'Camera Off';
  btnToggleScreen.textContent = 'Share Screen';
  btnToggleMic.classList.remove('active');
  btnToggleCam.classList.remove('active');
  btnToggleScreen.classList.remove('active');
}

function renderParticipantTiles() {
  const participants = rtcState.activeCall?.participants || [];
  const others = participants.filter((p) => p.user_id !== userId);

  remoteGrid.innerHTML = '';

  if (!others.length) {
    remoteGrid.classList.add('hidden');
    callEmptyState.classList.remove('hidden');
    callStageStatus.textContent = 'Waiting for other participants to join...';
  } else {
    callEmptyState.classList.add('hidden');
    remoteGrid.classList.remove('hidden');
  }

  others.forEach((participant) => {
    const name =
      participant.user?.name || participant.user?.username || 'Participant';
    const tile = document.createElement('div');
    tile.className = 'participant-tile';
    tile.dataset.userId = participant.user_id;
    tile.innerHTML = `
      <div class="participant-fallback">
        <div class="participant-avatar">${escapeHtml(initial(name))}</div>
        <div class="participant-name">${escapeHtml(name)}</div>
      </div>
      <div class="participant-meta">
        <span class="participant-name">${escapeHtml(name)}</span>
        <div class="participant-flags">
          <span class="participant-flag">${participant.microphone ? 'Mic On' : 'Mic Off'}</span>
          <span class="participant-flag">${participant.camera ? 'Cam On' : 'Cam Off'}</span>
          ${
            participant.is_screen_sharing
              ? '<span class="participant-flag">Sharing</span>'
              : ''
          }
        </div>
      </div>
    `;
    remoteGrid.appendChild(tile);
  });

  callParticipantCount.textContent = `${participants.length} participant${participants.length === 1 ? '' : 's'}`;
}

function openCallOverlay() {
  rtcState.overlayVisible = true;
  callOverlay.classList.remove('hidden');
}

function closeCallOverlay() {
  rtcState.overlayVisible = false;
  callOverlay.classList.add('hidden');
}

function setActiveCall(call, { openOverlay = false } = {}) {
  rtcState.activeCall = call || null;
  rtcState.remoteTracks.clear();

  if (!call) {
    stopCallTimer();
    resetCallOverlayUi();
    closeCallOverlay();
    updateCallHeaderState();
    return;
  }

  callModeLabel.textContent = `${call.kind || 'VIDEO'} Call`;
  callPeerTitle.textContent = getCallTitle(call);
  startCallTimer(call.started_at);
  renderParticipantTiles();
  updateCallButtonsFromSelfParticipant();
  updateCallHeaderState();

  if (openOverlay) {
    openCallOverlay();
  }
}

function updateCallButtonsFromSelfParticipant() {
  const participant = rtcState.activeCall?.self_participant;
  if (!participant) return;

  btnToggleMic.textContent = participant.microphone ? 'Mute' : 'Unmute';
  btnToggleCam.textContent = participant.camera ? 'Camera Off' : 'Camera On';
  btnToggleScreen.textContent = participant.is_screen_sharing
    ? 'Stop Share'
    : 'Share Screen';
  btnToggleMic.classList.toggle('active', !participant.microphone);
  btnToggleCam.classList.toggle('active', !participant.camera);
  btnToggleScreen.classList.toggle('active', participant.is_screen_sharing);
}

async function fetchCallState(convId) {
  const res = await fetch(`${API}/rtc/conversations/${convId}/state`, {
    headers: authHeadersNoJson(),
  });
  if (!res.ok)
    throw new Error(await apiError(res, 'Failed to load call state'));
  const json = await res.json();
  return json.data || null;
}

async function refreshCallState(
  convId = activeConvId,
  { openOverlay = false } = {},
) {
  if (!convId) return;
  try {
    const call = await fetchCallState(convId);
    if (!call) {
      if (rtcState.activeCall?.conversation_id === convId) {
        setActiveCall(null);
      } else {
        updateCallHeaderState();
      }
      return;
    }
    setActiveCall(call, { openOverlay });
  } catch (error) {
    log('error', `rtc/state: ${error.message}`);
  }
}

async function requestRtc(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    method: options.method || 'POST',
    headers:
      options.body instanceof FormData
        ? authHeadersNoJson()
        : options.body
          ? authHeaders()
          : authHeadersNoJson(),
    body:
      options.body instanceof FormData
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
  });
  if (!res.ok) throw new Error(await apiError(res));
  return res.status === 204 ? null : res.json();
}

async function startCallFlow(kind) {
  if (!activeConvId) {
    log('error', 'Select a conversation first');
    return;
  }

  try {
    log('api', `POST /rtc/conversations/${activeConvId.slice(0, 8)}/start`);
    const json = await requestRtc(`/rtc/conversations/${activeConvId}/start`, {
      body: { kind },
    });
    const data = json?.data;
    if (!data?.livekit)
      throw new Error('LiveKit token missing from start response');
    setActiveCall(data, { openOverlay: true });
    await connectToLivekit(data);
  } catch (error) {
    log('error', `startCall: ${error.message}`);
    alert(error.message || 'Failed to start call');
  }
}

async function joinActiveCall(conversationId, { openOverlay = true } = {}) {
  try {
    log('api', `POST /rtc/conversations/${conversationId.slice(0, 8)}/join`);
    const json = await requestRtc(`/rtc/conversations/${conversationId}/join`);
    const data = json?.data;
    if (!data?.livekit)
      throw new Error('LiveKit token missing from join response');
    setActiveCall(data, { openOverlay });
    await connectToLivekit(data);
  } catch (error) {
    log('error', `joinCall: ${error.message}`);
    alert(error.message || 'Failed to join call');
  }
}

async function handleAcceptIncomingCall() {
  const incoming = rtcState.pendingIncomingCall;
  if (!incoming?.conversation_id) return;
  hideIncomingCall();
  if (!conversations.has(incoming.conversation_id)) {
    await loadConversations();
  }
  await selectConversation(incoming.conversation_id);
  await joinActiveCall(incoming.conversation_id, { openOverlay: true });
}

async function handleDeclineIncomingCall() {
  const incoming = rtcState.pendingIncomingCall;
  hideIncomingCall();
  if (!incoming?.conversation_id) return;
  try {
    await requestRtc(`/rtc/conversations/${incoming.conversation_id}/decline`);
  } catch (error) {
    log('error', `declineCall: ${error.message}`);
  }
}

function disconnectLivekitRoom(hideOverlay = true) {
  stopCallTimer();
  if (rtcState.room) {
    try {
      rtcState.room.disconnect();
    } catch {}
  }
  rtcState.room = null;
  rtcState.currentScreenShareEnabled = false;
  rtcState.remoteTracks.clear();
  if (hideOverlay) {
    closeCallOverlay();
  }
  resetCallOverlayUi();
  updateCallHeaderState();
}

async function connectToLivekit(callData) {
  const sdk = getLivekitSdk();
  if (!sdk?.Room) throw new Error('LiveKit browser SDK not loaded');

  if (rtcState.room) {
    disconnectLivekitRoom(false);
  }

  const room = new sdk.Room();
  rtcState.room = room;
  setCallConnectionLabel('Connecting...');
  openCallOverlay();

  const bindTrack = (track, participantIdentity) => {
    const tile = remoteGrid.querySelector(
      `[data-user-id="${participantIdentity}"]`,
    );
    if (!tile) return;

    if (track.kind === 'video') {
      let video = tile.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        tile.prepend(video);
      }
      track.attach(video);
    }

    if (track.kind === 'audio') {
      const attached = track.attach();
      attached.autoplay = true;
      attached.style.display = 'none';
      tile.appendChild(attached);
    }
  };

  room.on('participantConnected', (participant) => {
    setCallConnectionLabel(`${participant.identity} joined`);
  });
  room.on('participantDisconnected', (participant) => {
    const tile = remoteGrid.querySelector(
      `[data-user-id="${participant.identity}"]`,
    );
    tile?.querySelectorAll('video,audio').forEach((el) => el.remove());
    setCallConnectionLabel(`${participant.identity} left`);
  });
  room.on('trackSubscribed', (track, _pub, participant) => {
    bindTrack(track, participant.identity);
  });
  room.on('trackUnsubscribed', (_track, _pub, participant) => {
    const tile = remoteGrid.querySelector(
      `[data-user-id="${participant.identity}"]`,
    );
    tile?.querySelectorAll('video,audio').forEach((el) => el.remove());
  });
  room.on('disconnected', () => {
    setCallConnectionLabel('Disconnected');
  });

  await room.connect(callData.livekit.url, callData.livekit.token);

  const local = room.localParticipant;
  setCallConnectionLabel('Connected');
  callModeLabel.textContent = `${callData.kind} Call`;

  try {
    await local.setMicrophoneEnabled(true);
  } catch (error) {
    log('error', `mic: ${error.message}`);
  }

  if (callData.kind === 'VIDEO') {
    try {
      await local.setCameraEnabled(true);
      const videoPub = Array.from(local.videoTrackPublications.values())[0];
      if (videoPub?.track) {
        videoPub.track.attach(localVideo);
        localPreviewCard.classList.remove('hidden');
      }
    } catch (error) {
      log('error', `camera: ${error.message}`);
    }
  } else {
    localPreviewCard.classList.add('hidden');
  }

  updateCallButtonsFromSelfParticipant();
}

async function toggleParticipantState(patch) {
  if (!rtcState.activeCall?.conversation_id) return;

  const current = rtcState.activeCall.self_participant || {};
  const next = {
    camera: patch.camera !== undefined ? patch.camera : current.camera,
    microphone:
      patch.microphone !== undefined ? patch.microphone : current.microphone,
    is_screen_sharing:
      patch.is_screen_sharing !== undefined
        ? patch.is_screen_sharing
        : current.is_screen_sharing,
  };

  try {
    const json = await requestRtc(
      `/rtc/conversations/${rtcState.activeCall.conversation_id}/participants/me`,
      {
        method: 'PATCH',
        body: next,
      },
    );
    rtcState.activeCall.self_participant = json?.data?.participant || {
      ...current,
      ...next,
    };
    rtcState.activeCall.participants = (
      rtcState.activeCall.participants || []
    ).map((participant) =>
      participant.user_id === userId
        ? { ...participant, ...rtcState.activeCall.self_participant }
        : participant,
    );
    updateCallButtonsFromSelfParticipant();
    renderParticipantTiles();
  } catch (error) {
    alert(error.message || 'Failed to update participant state');
  }
}

async function leaveCurrentCall({ endForEveryone = false } = {}) {
  const conversationId = rtcState.activeCall?.conversation_id;
  if (!conversationId) return;

  try {
    await requestRtc(
      `/rtc/conversations/${conversationId}/${endForEveryone ? 'end' : 'leave'}`,
    );
  } catch (error) {
    log('error', `leaveCall: ${error.message}`);
  } finally {
    disconnectLivekitRoom(true);
    setActiveCall(null);
    await refreshCallState(conversationId);
  }
}

function handleIncomingCall(payload) {
  if (!payload || payload.started_by === userId) return;
  showIncomingCall(payload);
  if (payload.conversation_id === activeConvId) {
    refreshCallState(payload.conversation_id);
  }
}

function handleParticipantJoined(payload) {
  if (!payload?.conversation_id) return;
  if (
    !rtcState.activeCall ||
    rtcState.activeCall.conversation_id !== payload.conversation_id
  ) {
    if (payload.conversation_id === activeConvId)
      refreshCallState(payload.conversation_id);
    return;
  }

  const list = rtcState.activeCall.participants || [];
  const existing = list.find(
    (item) => item.user_id === payload.participant?.user_id,
  );
  if (!existing && payload.participant) {
    list.push(payload.participant);
  }
  rtcState.activeCall.participants = list;
  rtcState.activeCall.participant_count =
    payload.participant_count || list.length;
  renderParticipantTiles();
  updateCallHeaderState();
}

function handleParticipantLeft(payload) {
  if (!payload?.conversation_id) return;
  if (
    !rtcState.activeCall ||
    rtcState.activeCall.conversation_id !== payload.conversation_id
  ) {
    if (payload.conversation_id === activeConvId)
      refreshCallState(payload.conversation_id);
    return;
  }

  rtcState.activeCall.participants = (
    rtcState.activeCall.participants || []
  ).filter((participant) => participant.user_id !== payload.user_id);
  rtcState.activeCall.participant_count =
    payload.participant_count || rtcState.activeCall.participants.length;
  renderParticipantTiles();
  updateCallHeaderState();
}

function handleParticipantUpdated(payload) {
  if (!payload?.conversation_id || !payload?.participant) return;
  if (
    !rtcState.activeCall ||
    rtcState.activeCall.conversation_id !== payload.conversation_id
  ) {
    if (payload.conversation_id === activeConvId)
      refreshCallState(payload.conversation_id);
    return;
  }

  rtcState.activeCall.participants = (
    rtcState.activeCall.participants || []
  ).map((participant) =>
    participant.user_id === payload.participant.user_id
      ? { ...participant, ...payload.participant }
      : participant,
  );

  if (payload.participant.user_id === userId) {
    rtcState.activeCall.self_participant = {
      ...rtcState.activeCall.self_participant,
      ...payload.participant,
    };
    updateCallButtonsFromSelfParticipant();
  }

  renderParticipantTiles();
}

function handleCallEnded(payload) {
  if (payload?.conversation_id === rtcState.activeCall?.conversation_id) {
    disconnectLivekitRoom(true);
    setActiveCall(null);
  }
  if (payload?.conversation_id === activeConvId) {
    updateCallHeaderState();
  }
  if (
    rtcState.pendingIncomingCall?.conversation_id === payload?.conversation_id
  ) {
    hideIncomingCall();
  }
}

btnAudioCall.onclick = async () => {
  if (rtcState.activeCall?.conversation_id === activeConvId && !rtcState.room) {
    await joinActiveCall(activeConvId, { openOverlay: true });
    return;
  }
  if (rtcState.activeCall?.conversation_id === activeConvId && rtcState.room) {
    openCallOverlay();
    return;
  }
  await startCallFlow('AUDIO');
};

btnVideoCall.onclick = async () => {
  if (rtcState.activeCall?.conversation_id === activeConvId && !rtcState.room) {
    await joinActiveCall(activeConvId, { openOverlay: true });
    return;
  }
  if (rtcState.activeCall?.conversation_id === activeConvId && rtcState.room) {
    openCallOverlay();
    return;
  }
  await startCallFlow('VIDEO');
};

callChip.onclick = async () => {
  if (!activeConvId) return;
  if (rtcState.activeCall?.conversation_id === activeConvId && rtcState.room) {
    openCallOverlay();
    return;
  }
  if (rtcState.activeCall?.conversation_id === activeConvId) {
    await joinActiveCall(activeConvId, { openOverlay: true });
  }
};

btnAcceptCall.onclick = () => handleAcceptIncomingCall();
btnDeclineCall.onclick = () => handleDeclineIncomingCall();
btnCloseCallPanel.onclick = () => closeCallOverlay();
btnLeaveCall.onclick = () => leaveCurrentCall({ endForEveryone: false });
btnEndCall.onclick = () => leaveCurrentCall({ endForEveryone: true });
btnToggleMic.onclick = async () => {
  const current = rtcState.activeCall?.self_participant;
  if (!current) return;
  try {
    await rtcState.room?.localParticipant?.setMicrophoneEnabled(
      !current.microphone,
    );
  } catch {}
  await toggleParticipantState({ microphone: !current.microphone });
};
btnToggleCam.onclick = async () => {
  const current = rtcState.activeCall?.self_participant;
  if (!current) return;
  try {
    await rtcState.room?.localParticipant?.setCameraEnabled(!current.camera);
    if (!current.camera) {
      const videoPub = Array.from(
        rtcState.room?.localParticipant?.videoTrackPublications?.values?.() ||
          [],
      )[0];
      if (videoPub?.track) {
        videoPub.track.attach(localVideo);
        localPreviewCard.classList.remove('hidden');
      }
    } else {
      localPreviewCard.classList.add('hidden');
    }
  } catch {}
  await toggleParticipantState({ camera: !current.camera });
};
btnToggleScreen.onclick = async () => {
  const current = rtcState.activeCall?.self_participant;
  if (!current || !rtcState.room?.localParticipant?.setScreenShareEnabled)
    return;
  try {
    await rtcState.room.localParticipant.setScreenShareEnabled(
      !current.is_screen_sharing,
    );
    rtcState.currentScreenShareEnabled = !current.is_screen_sharing;
  } catch (error) {
    alert(error.message || 'Screen share failed');
    return;
  }
  await toggleParticipantState({
    is_screen_sharing: !current.is_screen_sharing,
  });
};

$('btn-back').onclick = () => {
  sidebar.classList.remove('hidden-mobile');
  chatActive.classList.add('hidden');
  chatEmpty.classList.remove('hidden');
  activeConvId = null;
  activeConvType = null;
  activeConversation = null;
  btnAudioCall.classList.add('hidden');
  btnVideoCall.classList.add('hidden');
  callChip.classList.add('hidden');
};

window.onload = () => {
  const tk = token();
  if (!tk) {
    authScreen.classList.remove('hidden');
    return;
  }

  try {
    const decoded = JSON.parse(atob(tk.split('.')[1]));
    userId = decoded.sub || decoded.userId;
    enterChat();
  } catch {
    localStorage.removeItem('chat_token');
    authScreen.classList.remove('hidden');
  }
};
