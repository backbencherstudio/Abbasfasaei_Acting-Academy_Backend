// ============================================================
// Chat Tester — Script  (wired to the REAL backend API)
// ============================================================
// Backend API endpoints:
//   POST   /api/auth/login           { email, password }
//   POST   /api/auth/register        { email, password }
//   POST   /api/conversations        { type:'DM', participant_id } | { type:'GROUP', title, participant_ids }
//   GET    /api/conversations
//   GET    /api/conversations/:id/messages
//   POST   /api/conversations/:id/messages   (FormData: content, kind, attachments)
//   PATCH  /api/conversations/:id/read       { up_to_message_id }
//   GET    /api/conversations/:id/members
//   POST   /api/conversations/:id/members    { member_ids }
//   GET    /api/conversations/discover_users?search=
//   DELETE /api/conversations/messages/:id
//
// Socket.IO namespace: /ws
//   Events: connection:ok, connection:error, message:new, message:read,
//           message:status, typing, presence:update, call:incoming, call:ended
//   Emits:  conversation:join, typing, message:read
// ============================================================

const ORIGIN = (() => {
  const saved = localStorage.getItem('chat_backend_origin');
  if (saved) return saved.replace(/\/$/, '');
  return `${location.protocol}//${location.hostname}:7777`;
})();
const API = `${ORIGIN}/api`;
const WS_URL = `${ORIGIN}/ws`;

// ── DOM refs ──
const $ = (id) => document.getElementById(id);

const authScreen     = $('auth-screen');
const chatScreen     = $('chat-screen');
const jwtTokenInput  = $('jwt-token');
const connectBtn     = $('connect-btn');
const authMsg        = $('auth-msg');

const sidebar        = $('sidebar');
const convList       = $('conv-list');
const searchInput    = $('search-input');
const searchResults  = $('search-results');
const currentUserInfo= $('current-user-info');

const chatEmpty      = $('chat-empty');
const chatActive     = $('chat-active');
const chatTitle      = $('chat-title');
const chatStatus     = $('chat-status');
const messagesEl     = $('messages');
const typingBar      = $('typing-bar');
const typingText     = $('typing-text');
const msgInput       = $('msg-input');
const fileInput      = $('file-input');
const attachPreview  = $('attach-preview');
const btnMembers     = $('btn-members');

const logEntries     = $('log-entries');
const modal          = $('modal');
const modalTitle     = $('modal-title');
const modalBody      = $('modal-body');
const modalOk        = $('modal-ok');
const modalCancel    = $('modal-cancel');
const modalClose     = $('modal-close');

// ── State ──
let socket = null;
let userId = null;
let activeConvId = null;
let activeConvType = null;
let conversations = new Map();
let pendingFiles = [];
let typingTimer = null;
let searchTimer = null;
let modalResolve = null;

// ── Logging ──
function log(type, text) {
  const ts = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.innerHTML = `<span class="log-ts">${ts}</span>${text}`;
  logEntries.prepend(div);
  // Cap at 200
  while (logEntries.children.length > 200) logEntries.lastChild.remove();
}

$('btn-clear-log').onclick = () => { logEntries.innerHTML = ''; };

// ── Helpers ──
function token() { return localStorage.getItem('chat_token'); }
function authHeaders() { return { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }; }
function authHeadersNoJson() { return { Authorization: `Bearer ${token()}` }; }

async function apiError(res, fallback = 'Request failed') {
  try {
    const t = await res.text();
    const p = JSON.parse(t);
    return p.message || p.error || fallback;
  } catch { return fallback; }
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

// ============================================================
// AUTH
// ============================================================
connectBtn.onclick = () => {
  const tokenVal = jwtTokenInput.value.trim();
  if (!tokenVal) { showAuthMsg('JWT token is required'); return; }
  
  localStorage.setItem('chat_token', tokenVal);
  try {
    const decoded = JSON.parse(atob(tokenVal.split('.')[1]));
    userId = decoded.sub || decoded.userId;
    log('info', `✅ Logged in as ${userId}`);
    enterChat();
  } catch (e) {
    showAuthMsg('Invalid JWT token format');
    log('error', 'Token decode failed');
  }
};

$('btn-logout').onclick = () => {
  if (socket) socket.disconnect();
  localStorage.removeItem('chat_token');
  userId = null; activeConvId = null; conversations.clear();
  chatScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  log('info', 'Logged out');
};

// ============================================================
// ENTER CHAT (post-login)
// ============================================================
function enterChat() {
  authScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  currentUserInfo.textContent = `ID: ${userId?.slice(0, 8)}…`;
  loadConversations();
  connectSocket();
}

// ============================================================
// SOCKET.IO
// ============================================================
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
    log('socket', `🟢 Connected (sid: ${socket.id})`);
    if (activeConvId) socket.emit('conversation:join', { conversationId: activeConvId });
  });

  socket.on('connection:ok', (d) => log('socket', `connection:ok — user_id=${d.user_id}`));

  socket.on('connection:error', (d) => {
    log('error', `connection:error — ${d.message}`);
    socket.disconnect();
  });

  socket.on('connect_error', (e) => log('error', `connect_error: ${e.message}`));
  socket.on('disconnect', (reason) => log('socket', `🔴 Disconnected: ${reason}`));

  socket.on('message:new', (msg) => {
    log('socket', `📩 message:new — conv=${msg.conversation_id}, from=${msg.sender?.id?.slice(0,8)}`);
    if (msg.conversation_id === activeConvId) {
      appendMessage(msg);
      // Auto mark as read
      if (msg.sender?.id !== userId && msg.id) {
        markAsRead(activeConvId, msg.id);
      }
    }
    loadConversations(); // refresh sidebar
  });

  socket.on('message:status', (d) => {
    log('socket', `📬 message:status — status=${d.status}, count=${d.message_ids?.length}`);
  });

  socket.on('message:read', (d) => {
    log('socket', `👁️ message:read — user=${d.user_id?.slice(0,8)}, conv=${d.conversation_id?.slice(0,8)}`);
  });

  socket.on('typing', (d) => {
    if (d.user_id === userId) return;
    if (d.conversation_id !== activeConvId) return;
    log('socket', `✏️ typing — ${d.user_name || d.user_id?.slice(0,8)} ${d.on ? 'started' : 'stopped'}`);
    if (d.on) {
      typingText.textContent = `${d.user_name || 'Someone'} is typing…`;
      typingBar.classList.remove('hidden');
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => typingBar.classList.add('hidden'), 3000);
    } else {
      typingBar.classList.add('hidden');
    }
  });

  socket.on('presence:update', (d) => {
    log('socket', `🟢 presence — ${d.user_id?.slice(0,8)} ${d.online ? 'online' : 'offline'}`);
  });

  socket.on('call:incoming', (d) => log('socket', `📞 call:incoming — from ${d.from_user_id}`));
  socket.on('call:ended', (d) => log('socket', `📞 call:ended — by ${d.by_user_id}`));
}

// ============================================================
// CONVERSATIONS
// ============================================================
async function loadConversations() {
  try {
    log('api', 'GET /conversations');
    const res = await fetch(`${API}/conversations`, { headers: authHeadersNoJson() });
    if (!res.ok) throw new Error(await apiError(res));
    const json = await res.json();
    const list = json.data || json.items || [];
    log('api', `→ ${list.length} conversations loaded`);

    conversations.clear();
    convList.innerHTML = '';

    list.forEach((c) => {
      conversations.set(c.id, c);
      const li = document.createElement('li');
      li.className = `conv-item${c.id === activeConvId ? ' active' : ''}`;
      li.dataset.id = c.id;

      const title = c.type === 'GROUP' ? (c.title || 'Group') : (c.participant?.name || c.participant?.username || 'DM');
      const preview = c.last_message?.content?.text || '(no messages)';
      const unread = c.unread_messages || 0;

      li.innerHTML = `
        <div class="conv-avatar">${initial(title)}</div>
        <div class="conv-meta">
          <span class="conv-name">${title}</span>
          <span class="conv-preview">${preview}</span>
        </div>
        ${unread > 0 ? `<span class="conv-badge">${unread}</span>` : ''}
      `;
      li.onclick = () => selectConversation(c.id, title, c.type);
      convList.appendChild(li);
    });
  } catch (e) {
    log('error', `loadConversations: ${e.message}`);
  }
}

async function selectConversation(convId, title, type) {
  activeConvId = convId;
  activeConvType = type || 'DM';
  chatEmpty.classList.add('hidden');
  chatActive.classList.remove('hidden');
  chatTitle.textContent = title;
  chatStatus.textContent = type === 'GROUP' ? 'Group Chat' : 'Direct Message';
  btnMembers.classList.toggle('hidden', type !== 'GROUP');
  messagesEl.innerHTML = '';
  pendingFiles = [];
  renderAttachPreview();

  // Highlight
  convList.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('active', el.dataset.id === convId));

  // Join room
  if (socket) {
    socket.emit('conversation:join', { conversationId: convId });
    log('socket', `EMIT conversation:join — ${convId.slice(0,8)}`);
  }

  // Load messages
  await loadMessages(convId);

  // Mobile: hide sidebar
  if (window.innerWidth <= 768) sidebar.classList.add('hidden-mobile');
}

async function loadMessages(convId) {
  try {
    log('api', `GET /conversations/${convId.slice(0,8)}/messages`);
    const res = await fetch(`${API}/conversations/${convId}/messages`, { headers: authHeadersNoJson() });
    if (!res.ok) throw new Error(await apiError(res));
    const json = await res.json();
    const msgs = json.data || json.items || [];
    log('api', `→ ${msgs.length} messages loaded`);

    messagesEl.innerHTML = '';
    // Messages come newest-first, reverse for display
    const ordered = [...msgs].reverse();
    ordered.forEach(m => appendMessage(m));
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Mark last incoming as read
    const lastIncoming = msgs.find(m => m.sender?.id !== userId);
    if (lastIncoming?.id) {
      markAsRead(convId, lastIncoming.id);
    }
  } catch (e) {
    log('error', `loadMessages: ${e.message}`);
  }
}

function appendMessage(msg) {
  // Deduplicate
  if (messagesEl.querySelector(`[data-id="${msg.id}"]`)) return;

  const isMe = msg.sender?.id === userId;
  const div = document.createElement('div');
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  div.dataset.id = msg.id;

  const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
  const text = msg.content?.text || '';
  const senderName = msg.sender?.name || msg.sender?.id?.slice(0, 8) || '?';

  let html = '<div class="msg-bubble">';

  // Reply preview
  if (msg.reply_to) {
    const replyText = msg.reply_to.content?.text || '(attachment)';
    html += `<div class="msg-reply">↩ ${replyText}</div>`;
  }

  // Sender name (for group + incoming)
  if (!isMe && activeConvType === 'GROUP') {
    html += `<div class="msg-sender">${senderName}</div>`;
  }

  // Text
  if (text) {
    html += `<p class="msg-text">${escapeHtml(text)}</p>`;
  }

  // Attachments
  if (msg.attachments?.length) {
    msg.attachments.forEach(att => {
      const url = att.file_path || '';
      if (att.type === 'IMAGE' || att.mime_type?.startsWith('image')) {
        html += `<div class="msg-attachment"><img src="${url}" alt="${att.file_name || 'image'}" loading="lazy" /></div>`;
      } else if (att.type === 'VIDEO' || att.mime_type?.startsWith('video')) {
        html += `<div class="msg-attachment"><video src="${url}" controls style="max-width:220px;border-radius:8px;"></video></div>`;
      } else {
        html += `<div class="msg-attachment"><a href="${url}" target="_blank">📎 ${att.file_name || 'File'}</a></div>`;
      }
    });
  }

  // Time + status
  html += `<span class="msg-time">${time}`;
  if (isMe && msg.status) {
    const icons = { SENT: '✓', DELIVERED: '✓✓', READ: '✓✓' };
    html += ` <span class="msg-status">${icons[msg.status] || ''}</span>`;
  }
  html += `</span>`;
  html += '</div>';
  div.innerHTML = html;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ============================================================
// SEND MESSAGE
// ============================================================
$('btn-send').onclick = () => sendMessage();
msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

msgInput.addEventListener('input', () => {
  if (!socket || !activeConvId) return;
  socket.emit('typing', { conversationId: activeConvId, on: true });
  log('socket', `EMIT typing — on`);
});

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!activeConvId) { log('error', 'No conversation selected'); return; }
  if (!text && !pendingFiles.length) return;

  // Build FormData (backend expects multipart when attachments present)
  const formData = new FormData();
  if (text) {
    formData.append('content', JSON.stringify({ text }));
  }
  formData.append('kind', pendingFiles.length ? inferKind(pendingFiles[0]) : 'TEXT');

  pendingFiles.forEach(f => formData.append('attachments', f));

  msgInput.value = '';
  const fileCount = pendingFiles.length;
  pendingFiles = [];
  renderAttachPreview();

  try {
    log('api', `POST /conversations/${activeConvId.slice(0,8)}/messages ${fileCount ? `(${fileCount} files)` : ''}`);
    const res = await fetch(`${API}/conversations/${activeConvId}/messages`, {
      method: 'POST',
      headers: authHeadersNoJson(),
      body: formData,
    });
    if (!res.ok) {
      const errMsg = await apiError(res, 'Send failed');
      log('error', `sendMessage: ${errMsg}`);
      return;
    }
    const json = await res.json();
    log('api', `→ Message sent: ${json.data?.id?.slice(0,8) || 'ok'}`);
    // Message will appear via socket message:new event
    // But also append from response for instant feedback
    if (json.data) appendMessage(json.data);
    loadConversations(); // refresh sidebar
  } catch (e) {
    log('error', `sendMessage: ${e.message}`);
  }

  // Stop typing
  if (socket) socket.emit('typing', { conversationId: activeConvId, on: false });
}

function inferKind(file) {
  if (file?.type?.startsWith('image/')) return 'IMAGE';
  if (file?.type?.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}

// ============================================================
// MARK AS READ
// ============================================================
async function markAsRead(convId, messageId) {
  try {
    log('api', `PATCH /conversations/${convId.slice(0,8)}/read — up_to=${messageId.slice(0,8)}`);
    await fetch(`${API}/conversations/${convId}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ up_to_message_id: messageId }),
    });
  } catch (e) {
    log('error', `markAsRead: ${e.message}`);
  }
}

// ============================================================
// FILE ATTACHMENTS
// ============================================================
$('btn-attach').onclick = () => { if (!activeConvId) { log('error', 'Select a conversation first'); return; } fileInput.click(); };

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  files.forEach(f => pendingFiles.push(f));
  fileInput.value = '';
  renderAttachPreview();
  log('info', `${pendingFiles.length} file(s) queued`);
});

function renderAttachPreview() {
  if (!pendingFiles.length) {
    attachPreview.classList.add('hidden');
    attachPreview.innerHTML = '';
    return;
  }
  attachPreview.classList.remove('hidden');
  attachPreview.innerHTML = pendingFiles.map((f, i) => {
    const isImg = f.type?.startsWith('image/');
    const preview = isImg ? URL.createObjectURL(f) : '';
    return `
      <div class="attach-thumb">
        ${isImg ? `<img src="${preview}" />` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:.6rem;color:#888;">${f.name.split('.').pop()?.toUpperCase()}</div>`}
        <button class="remove" data-idx="${i}">&times;</button>
      </div>
    `;
  }).join('');
}

attachPreview.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove');
  if (!btn) return;
  const idx = +btn.dataset.idx;
  pendingFiles.splice(idx, 1);
  renderAttachPreview();
});

// ============================================================
// SEARCH / DISCOVER USERS
// ============================================================
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (!q || q.length < 2) { searchResults.classList.add('hidden'); return; }

  searchTimer = setTimeout(async () => {
    try {
      log('api', `GET /conversations/discover_users?search=${q}`);
      const res = await fetch(`${API}/conversations/discover_users?search=${encodeURIComponent(q)}`, { headers: authHeadersNoJson() });
      if (!res.ok) throw new Error(await apiError(res));
      const json = await res.json();
      const users = json.data || [];
      log('api', `→ ${users.length} users found`);

      if (!users.length) {
        searchResults.innerHTML = '<div class="search-item" style="color:#888;cursor:default;">No users found</div>';
        searchResults.classList.remove('hidden');
        return;
      }
      searchResults.innerHTML = users.map(u => `
        <div class="search-item" data-uid="${u.id}">
          <div>
            <div class="name">${u.name || u.username || 'User'}</div>
            <div class="sub">${u.username || ''}</div>
          </div>
        </div>
      `).join('');
      searchResults.classList.remove('hidden');
    } catch (e) {
      log('error', `discover: ${e.message}`);
      searchResults.innerHTML = '<div class="search-item" style="color:#f87171;cursor:default;">Error fetching users</div>';
      searchResults.classList.remove('hidden');
    }
  }, 300);
});

searchResults.addEventListener('click', async (e) => {
  const item = e.target.closest('.search-item[data-uid]');
  if (!item) return;
  const uid = item.dataset.uid;
  const name = item.querySelector('.name')?.textContent || 'DM';
  searchResults.classList.add('hidden');
  searchInput.value = '';

  // Create DM
  try {
    log('api', `POST /conversations — DM with ${uid.slice(0,8)}`);
    const res = await fetch(`${API}/conversations`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ type: 'DM', participant_id: uid }),
    });
    if (!res.ok) throw new Error(await apiError(res));
    const json = await res.json();
    const conv = json.data;
    log('api', `→ DM created/found: ${conv.id?.slice(0,8)}`);
    await loadConversations();
    selectConversation(conv.id, name, 'DM');
  } catch (e) {
    log('error', `createDM: ${e.message}`);
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.sidebar-search')) searchResults.classList.add('hidden');
});

// ============================================================
// NEW DM / GROUP MODALS
// ============================================================
$('btn-new-dm').onclick = () => {
  searchInput.focus();
  log('info', 'Type a name in the search bar to create a DM');
};

$('btn-new-group').onclick = async () => {
  const result = await openGroupModal();
  if (!result) return;
  try {
    log('api', `POST /conversations — GROUP "${result.title}" with ${result.ids.length} members`);
    const res = await fetch(`${API}/conversations`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ type: 'GROUP', title: result.title, participant_ids: result.ids }),
    });
    if (!res.ok) throw new Error(await apiError(res));
    const json = await res.json();
    log('api', `→ Group created: ${json.data?.id?.slice(0,8)}`);
    await loadConversations();
    selectConversation(json.data.id, result.title, 'GROUP');
  } catch (e) { log('error', `createGroup: ${e.message}`); }
};

// Members button
btnMembers.onclick = async () => {
  if (!activeConvId) return;
  try {
    log('api', `GET /conversations/${activeConvId.slice(0,8)}/members`);
    const res = await fetch(`${API}/conversations/${activeConvId}/members`, { headers: authHeadersNoJson() });
    if (!res.ok) throw new Error(await apiError(res));
    const json = await res.json();
    const members = json.data || [];
    log('api', `→ ${members.length} members`);
    modalTitle.textContent = 'Group Members';
    modalBody.innerHTML = members.map(m => `
      <div class="modal-result-item" style="cursor:default;">
        <div class="conv-avatar" style="width:32px;height:32px;font-size:.75rem;">${initial(m.name)}</div>
        <div>
          <div style="font-size:.85rem;font-weight:500;">${m.name || 'Unknown'}</div>
          <div style="font-size:.72rem;color:#888;">${m.role}${m.is_me ? ' (You)' : ''}</div>
        </div>
      </div>
    `).join('');
    modalOk.textContent = 'Close';
    modal.classList.remove('hidden');
    modalOk.onclick = () => modal.classList.add('hidden');
    modalCancel.classList.add('hidden');
  } catch (e) { log('error', `getMembers: ${e.message}`); }
};

function openGroupModal() {
  return new Promise((resolve) => {
    modalTitle.textContent = 'Create Group';
    modalCancel.classList.remove('hidden');
    const selected = [];

    modalBody.innerHTML = `
      <input id="group-title-input" type="text" placeholder="Group title" />
      <input id="group-search-input" type="text" placeholder="Search users to add..." />
      <div id="group-selected" style="margin:6px 0;display:flex;flex-wrap:wrap;gap:4px;"></div>
      <div id="group-results"></div>
    `;

    const titleInput = $('group-title-input');
    const groupSearch = $('group-search-input');
    const groupSelected = $('group-selected');
    const groupResults = $('group-results');

    function renderSelected() {
      groupSelected.innerHTML = selected.map((u, i) =>
        `<span class="modal-user-chip">${u.name} <span class="x" data-idx="${i}">&times;</span></span>`
      ).join('');
    }

    groupSelected.addEventListener('click', (e) => {
      const x = e.target.closest('.x');
      if (x) { selected.splice(+x.dataset.idx, 1); renderSelected(); }
    });

    let gTimer;
    groupSearch.addEventListener('input', () => {
      clearTimeout(gTimer);
      const q = groupSearch.value.trim();
      if (q.length < 2) { groupResults.innerHTML = ''; return; }
      gTimer = setTimeout(async () => {
        try {
          const res = await fetch(`${API}/conversations/discover_users?search=${encodeURIComponent(q)}`, { headers: authHeadersNoJson() });
          const json = await res.json();
          const users = (json.data || []).filter(u => u.id !== userId && !selected.find(s => s.id === u.id));
          groupResults.innerHTML = users.map(u => `
            <div class="modal-result-item" data-uid="${u.id}" data-name="${(u.name || u.username || 'User').replace(/"/g,'&quot;')}">
              <div class="conv-avatar" style="width:28px;height:28px;font-size:.7rem;">${initial(u.name || u.username)}</div>
              <div><div style="font-size:.82rem;">${u.name || u.username || 'User'}</div></div>
            </div>
          `).join('');
        } catch { groupResults.innerHTML = '<div style="color:#f87171;font-size:.8rem;padding:4px;">Search error</div>'; }
      }, 300);
    });

    groupResults.addEventListener('click', (e) => {
      const item = e.target.closest('.modal-result-item');
      if (!item) return;
      selected.push({ id: item.dataset.uid, name: item.dataset.name });
      renderSelected();
      item.remove();
    });

    modalOk.textContent = 'Create';
    modal.classList.remove('hidden');

    modalOk.onclick = () => {
      const title = titleInput.value.trim();
      if (!title) { titleInput.style.borderColor = '#f87171'; return; }
      if (!selected.length) return;
      modal.classList.add('hidden');
      resolve({ title, ids: selected.map(s => s.id) });
    };
    modalCancel.onclick = () => { modal.classList.add('hidden'); resolve(null); };
    modalClose.onclick = () => { modal.classList.add('hidden'); resolve(null); };
  });
}

modalClose.onclick = () => modal.classList.add('hidden');

// ============================================================
// BACK BUTTON (mobile)
// ============================================================
$('btn-back').onclick = () => {
  sidebar.classList.remove('hidden-mobile');
  chatActive.classList.add('hidden');
  chatEmpty.classList.remove('hidden');
};

// ============================================================
// BOOT
// ============================================================
window.onload = () => {
  const tk = token();
  if (!tk) { authScreen.classList.remove('hidden'); return; }
  try {
    const decoded = JSON.parse(atob(tk.split('.')[1]));
    userId = decoded.sub || decoded.userId;
    enterChat();
  } catch {
    localStorage.removeItem('chat_token');
    authScreen.classList.remove('hidden');
  }
};
