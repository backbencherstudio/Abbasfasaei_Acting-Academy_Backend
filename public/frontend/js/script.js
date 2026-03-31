// --- Configuration ---
const defaultBackendOrigin = `${window.location.protocol}//${window.location.hostname}:4000`;
const configuredOrigin = localStorage.getItem('backend_origin') || defaultBackendOrigin;
const BACKEND_ORIGIN = configuredOrigin.replace(/\/$/, '');
const API_BASE = `${BACKEND_ORIGIN}/api`;
const SOCKET_URL = `${BACKEND_ORIGIN}/ws`;

if (window.location.origin !== BACKEND_ORIGIN) {
  console.info(
    `[Frontend] Using backend origin ${BACKEND_ORIGIN} while UI is served from ${window.location.origin}`,
  );
}

// --- UI Element References ---
const authView = document.getElementById('auth-view');
const chatView = document.getElementById('chat-view');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const messageBox = document.getElementById('message-box');

const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');

const messageInput = document.getElementById('message-text');
const sendMessageBtn = document.getElementById('send-message-btn');
const messagesContainer = document.getElementById('messages');
const conversationList = document.getElementById('conversation-list');
const chatTitle = document.getElementById('chat-title');
const chatAvatar = document.getElementById('chat-avatar');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const userIdDisplay = document.getElementById('user-id-display');
const typingIndicator = document.getElementById('typing-indicator');

const audioCallBtn = document.getElementById('audio-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const callOverlay = document.getElementById('call-overlay');
const localVideoEl = document.getElementById('local-video');
const remoteVideosEl = document.getElementById('remote-videos');
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');
const hangupBtn = document.getElementById('hangup-btn');
const callStatusEl = document.getElementById('call-status');
const incomingCallBanner = document.getElementById('incoming-call-banner');
const incomingCallText = document.getElementById('incoming-call-text');
const incomingCallAcceptBtn = document.getElementById('incoming-call-accept');
const incomingCallRejectBtn = document.getElementById('incoming-call-reject');
const actionModal = document.getElementById('action-modal');
const actionModalTitle = document.getElementById('action-modal-title');
const actionModalClose = document.getElementById('action-modal-close');
const actionModalCancel = document.getElementById('action-modal-cancel');
const actionModalSubmit = document.getElementById('action-modal-submit');
const actionModalFieldWrap = document.getElementById('action-modal-field-wrap');
const actionModalField = document.getElementById('action-modal-field');
const actionModalSearch = document.getElementById('action-modal-search');
const actionModalSelected = document.getElementById('action-modal-selected');
const actionModalResults = document.getElementById('action-modal-results');
const actionModalError = document.getElementById('action-modal-error');

const newChatBtn = document.getElementById('new-chat-btn');
const newGroupBtn = document.getElementById('new-group-btn');
const menuBtn = document.getElementById('menu-btn');
const attachBtn = document.getElementById('attach-btn');
const attachmentInput = document.getElementById('attachment-input');
const pendingAttachmentsEl = document.getElementById('pending-attachments');

const searchInput = document.querySelector('.sidebar-search input');
const suggestionBox = document.querySelector('.sidebar-search .suggestion-box');

// --- App State ---
let socket;
let userId = null;
let currentConversationId = null;
let typingTimeout = null;
let searchDebounce = null;
let isRendering = false;
let headerActionMenu = null;
let selectedConversationSnapshot = null;
const conversationsById = new Map();
let pendingAttachments = [];
let modalSearchDebounce = null;
const modalState = {
  mode: null,
  selectedUsers: [],
  excludedIds: new Set(),
};

const onlineUsers = new Set();

// LiveKit call state
let lkRoom = null;
let micEnabled = true;
let camEnabled = true;
let currentCallKind = 'VIDEO';
let pendingIncomingCall = null;

function getFriendlyCallError(error, fallback = 'Call failed') {
  const raw = String(error?.message || error || '');

  if (/ECONNREFUSED|ERR_CONNECTION_REFUSED|Failed to fetch/i.test(raw)) {
    return 'Cannot reach LiveKit server. Ensure it is running and LK_WS_URL is correct.';
  }
  if (/Requested device not found|NotFoundError|DevicesNotFoundError/i.test(raw)) {
    return 'Microphone/camera device not found on this browser. Check media devices and permissions.';
  }
  if (/NotAllowedError|Permission denied/i.test(raw)) {
    return 'Microphone/camera permission denied. Allow access and try again.';
  }
  return fallback;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    'Content-Type': 'application/json',
  };
}

function unwrapApiPayload(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

async function readApiError(response, fallback = 'Request failed') {
  try {
    const text = await response.text();
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text);
      return parsed.message || parsed.error || fallback;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

// --- UI State Management ---
function showMessageBox(message, type = 'success') {
  messageBox.textContent = message;
  messageBox.classList.remove('error', 'success');
  messageBox.classList.add(type);
  messageBox.style.display = 'block';
}

function showIncomingCallBanner(call) {
  pendingIncomingCall = call;
  incomingCallText.textContent = `${call.kind || 'VIDEO'} call from ${call.fromUserId}`;
  incomingCallBanner.classList.remove('hidden');
}

function hideIncomingCallBanner() {
  pendingIncomingCall = null;
  incomingCallBanner.classList.add('hidden');
}

function hideMessageBox() {
  messageBox.style.display = 'none';
}

function showLoginForm() {
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
  hideMessageBox();
}

function showRegisterForm() {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
  hideMessageBox();
}

function showChatView() {
  authView.style.display = 'none';
  chatView.style.display = 'flex';
}

function showAuthView() {
  authView.style.display = 'flex';
  chatView.style.display = 'none';
}

function getConversationTitle(conv) {
  if (conv.type === 'GROUP') return conv.title || 'Untitled Group';
  if (conv.creator_id === userId) return conv.receiverTitle || 'Direct Message';
  return conv.senderTitle || 'Direct Message';
}

function getConversationAvatarUrl(conv) {
  if (!conv) return null;

  if (conv.type === 'DM') {
    return conv.otherUserAvatar || null;
  }

  return conv.avatarUrl || null;
}

function getInitialAvatarUrl(label, size = 40) {
  const first = getAvatarFallbackTitle(label);
  return `https://placehold.co/${size}x${size}/d1d5db/ffffff?text=${encodeURIComponent(first)}`;
}

function resolveMessageSenderAvatarUrl(message) {
  if (!message || !message.sender) return message?.senderAvatarUrl || null;

  if (message.senderAvatarUrl) return message.senderAvatarUrl;
  if (message.sender.avatarUrl) return message.sender.avatarUrl;

  if (
    typeof message.sender.avatar === 'string' &&
    (message.sender.avatar.startsWith('http://') ||
      message.sender.avatar.startsWith('https://'))
  ) {
    return message.sender.avatar;
  }

  return null;
}

function updateChatHeader(conversation, title) {
  chatTitle.textContent = title || 'Select a Chat';

  if (!chatAvatar) return;
  if (!conversation) {
    chatAvatar.src = getInitialAvatarUrl('Chat', 48);
    return;
  }

  const avatarUrl = getConversationAvatarUrl(conversation);
  const fallback = getInitialAvatarUrl(title || 'Chat', 48);
  chatAvatar.src = avatarUrl || fallback;
  chatAvatar.onerror = () => {
    chatAvatar.onerror = null;
    chatAvatar.src = fallback;
  };
}

function getAvatarFallbackTitle(title) {
  if (!title) return 'U';
  const first = String(title).trim().charAt(0).toUpperCase();
  return first || 'U';
}

function getConversationLastMessagePreview(conv) {
  const last = Array.isArray(conv?.messages) ? conv.messages[0] : null;
  if (!last) return 'No messages yet';

  const isMine = last.senderId === userId;
  const prefix = isMine ? 'You: ' : '';
  const kind = String(last.kind || 'TEXT').toUpperCase();

  if (kind === 'TEXT') {
    const text = last.content?.text || '';
    return text ? `${prefix}${text}` : `${prefix}(empty)`;
  }

  if (kind === 'IMAGE') return `${prefix}Photo`;
  if (kind === 'VIDEO') return `${prefix}Video`;
  if (kind === 'FILE') {
    const fileName = last.content?.fileName || 'File';
    return `${prefix}${fileName}`;
  }
  if (kind === 'AUDIO') return `${prefix}Audio`;

  return `${prefix}New message`;
}

function createMessageElement(message, isSentByMe) {
  const div = document.createElement('div');
  div.classList.add(isSentByMe ? 'message-sent' : 'message-received');
  if (message.id) div.dataset.messageId = message.id;

  const created = message.createdAt || message.timestamp;
  const time = created
    ? new Date(created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const text = message.content?.text || '';
  const kind = message.kind || 'TEXT';
  const mediaUrl = message.media_Url || message.mediaUrl || message.content?.url || '';
  const senderName = message.sender?.name || 'User';
  const senderAvatarUrl = resolveMessageSenderAvatarUrl(message);

  let htmlContent = '';
  if (!isSentByMe) {
    const fallbackAvatar = getInitialAvatarUrl(senderName, 40);
    const safeSenderAvatar = String(senderAvatarUrl || fallbackAvatar).replace(/"/g, '&quot;');
    const safeFallbackAvatar = String(fallbackAvatar).replace(/"/g, '&quot;');
    const safeSenderName = String(senderName).replace(/"/g, '&quot;');
    htmlContent += `<img src="${safeSenderAvatar}" alt="${safeSenderName} avatar" style="width:2.5rem;height:2.5rem;border-radius:9999px;object-fit:cover;flex-shrink:0;" onerror="this.onerror=null;this.src='${safeFallbackAvatar}'">`;
  }

  htmlContent += `<div class="message-bubble ${isSentByMe ? 'sent' : 'received'}">`;
  if (text) {
    htmlContent += `<p class="message-text">${text}</p>`;
  }

  if (mediaUrl) {
    const safeUrl = String(mediaUrl).replace(/"/g, '&quot;');
    if (kind === 'IMAGE') {
      htmlContent += `<div class="message-attachment"><img src="${safeUrl}" alt="Image attachment" loading="lazy" /></div>`;
    } else if (kind === 'VIDEO') {
      htmlContent += `<div class="message-attachment"><video src="${safeUrl}" controls playsinline></video></div>`;
    } else {
      const fileName = message.content?.fileName || 'Open attachment';
      htmlContent += `<div class="message-attachment"><a class="message-file-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">📎 ${fileName}</a></div>`;
    }
  }

  if (!text && !mediaUrl) {
    htmlContent += `<p class="message-text">(empty message)</p>`;
  }
  htmlContent += `<p class="message-time">${time}</p>`;
  htmlContent += `</div>`;
  div.innerHTML = htmlContent;
  return div;
}

function inferMessageKindFromFile(file) {
  if (!file?.type) return 'FILE';
  if (file.type.startsWith('image/')) return 'IMAGE';
  if (file.type.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}

function pendingAttachmentId(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function createPendingAttachmentItem(file) {
  const isPreviewable = file.type?.startsWith('image/');
  return {
    id: pendingAttachmentId(file),
    file,
    previewUrl: isPreviewable ? URL.createObjectURL(file) : null,
  };
}

function renderPendingAttachments() {
  if (!pendingAttachments.length) {
    pendingAttachmentsEl.innerHTML = '';
    pendingAttachmentsEl.classList.add('hidden');
    return;
  }

  pendingAttachmentsEl.classList.remove('hidden');
  pendingAttachmentsEl.innerHTML = pendingAttachments
    .map((item, idx) => {
      const file = item.file;
      let previewHtml = '<div class="pending-thumb" style="display:flex;align-items:center;justify-content:center;font-size:.72rem;color:#334155;">FILE</div>';
      if (item.previewUrl) {
        previewHtml = `<img class="pending-thumb" src="${item.previewUrl}" alt="${file.name}" />`;
      } else if (file.type?.startsWith('video/')) {
        previewHtml = '<div class="pending-thumb" style="display:flex;align-items:center;justify-content:center;font-size:.72rem;color:#334155;">VIDEO</div>';
      }

      return `
        <div class="pending-item">
          ${previewHtml}
          <button class="pending-remove" type="button" data-index="${idx}">x</button>
          <div class="pending-file-name" title="${file.name}">${file.name}</div>
        </div>
      `;
    })
    .join('');
}

function clearPendingAttachments() {
  pendingAttachments.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
  pendingAttachments = [];
  renderPendingAttachments();
}

// --- Auth ---
async function handleLogin() {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { success: false, message: raw };
    }

    if (!response.ok || !data.success) {
      const msg = response.status === 401 ? 'Invalid email or password' : data.message || 'Login failed';
      showMessageBox(msg, 'error');
      return;
    }

    const access = data.authorization?.access_token;
    const refresh = data.authorization?.refresh_token;
    if (!access) {
      showMessageBox('Server response missing access token', 'error');
      return;
    }

    localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);

    try {
      const decoded = JSON.parse(atob(access.split('.')[1]));
      userId = decoded.sub;
    } catch {
      showMessageBox('Could not decode login token', 'error');
      return;
    }

    showChatView();
    userIdDisplay.textContent = `User ID: ${userId}`;
    await renderConversations();
    connectSocket();
  } catch (error) {
    console.error('Login error:', error);
    showMessageBox('Login failed. Please try again.', 'error');
  }
}

async function handleRegister() {
  const email = registerEmailInput.value.trim().toLowerCase();
  const password = registerPasswordInput.value;

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      showMessageBox(data.message || 'Registration failed', 'error');
      return;
    }

    showMessageBox('Registration successful. Please login.', 'success');
    showLoginForm();
  } catch (error) {
    console.error('Register error:', error);
    showMessageBox('Registration failed. Please try again.', 'error');
  }
}

// --- Socket ---
function connectSocket() {
  if (socket?.connected) return;

  const token = localStorage.getItem('access_token');
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    showChatView();
    renderConversations();
  });

  socket.on('connection:error', (data) => {
    showMessageBox(`Connection error: ${data.message}`, 'error');
    socket.disconnect();
    showAuthView();
  });

  socket.on('connect_error', (error) => {
    console.warn('Socket connect_error:', error?.message || error);
  });

  socket.on('presence:update', ({ userId: uid, online }) => {
    if (online) onlineUsers.add(uid);
    else onlineUsers.delete(uid);
    renderConversations();
  });

  socket.on('message:new', (msg) => {
    const isActiveConversation = msg.conversationId === currentConversationId;

    if (isActiveConversation) {
      const exists = Array.from(messagesContainer.children).some((el) => el.dataset.messageId === msg.id);
      if (!exists) {
        const messageElement = createMessageElement(msg, msg.senderId === userId);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }

      if (msg.senderId !== userId) {
        void markConversationRead(msg.conversationId, msg.createdAt);
      }
      return;
    }

    // New message in another conversation: refresh unread badges.
    void renderConversations();
  });

  socket.on('typing', (data) => {
    if (data.userId === userId) return;
    typingIndicator.textContent = `${data.userName || 'Someone'} is typing...`;
    typingIndicator.style.display = 'block';

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      typingIndicator.style.display = 'none';
    }, 1500);
  });

  socket.on('call:incoming', (payload) => {
    if (!payload || payload.fromUserId === userId) return;
    showIncomingCallBanner(payload);
  });

  socket.on('call:ended', (payload) => {
    if (!payload) return;
    if (pendingIncomingCall?.conversationId === payload.conversationId) {
      hideIncomingCallBanner();
    }
    if (lkRoom && currentConversationId === payload.conversationId) {
      cleanupCallUI();
      showMessageBox('Call ended by other participant', 'success');
    }
  });
}

function sendTypingStatus(on) {
  if (!socket || !currentConversationId) return;
  socket.emit('typing', { conversationId: currentConversationId, on });
}

async function markConversationRead(conversationId, at) {
  if (!conversationId) return;
  try {
    await fetch(`${API_BASE}/conversations/${conversationId}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(at ? { at } : {}),
    });
  } catch (error) {
    console.warn('markConversationRead failed:', error);
  }
}

function filterConversationList(query) {
  const term = query.trim().toLowerCase();
  const items = conversationList.querySelectorAll('.conversation-item');

  items.forEach((item) => {
    const label = item.querySelector('span')?.textContent?.toLowerCase() || '';
    item.style.display = !term || label.includes(term) ? 'flex' : 'none';
  });
}

function renderSearchSuggestions({ query, conversations = [], users = [] }) {
  if (!query) {
    suggestionBox.innerHTML = '';
    suggestionBox.style.display = 'none';
    return;
  }

  const blocks = [];

  if (conversations.length) {
    const convHtml = conversations
      .map(
        (c) => `
          <div class="suggestion-item" data-type="conversation" data-id="${c.id}" data-title="${(c.title || '').replace(/"/g, '&quot;')}">
            <div class="suggestion-icon">#</div>
            <div>
              <div class="name">${c.title}</div>
              <div class="sub">Conversation</div>
            </div>
          </div>
        `,
      )
      .join('');
    blocks.push(`<div class="suggestion-section-title">Conversations</div>${convHtml}`);
  }

  if (users.length) {
    const userHtml = users
      .map(
        (u) => `
          <div class="suggestion-item" data-type="user" data-id="${u.id}">
            <img src="${u.avatar_url || 'https://placehold.co/24x24/ddd/fff?text=U'}" />
            <div>
              <div class="name">${u.name}</div>
              <div class="sub">${u.username || u.email || 'User'}</div>
            </div>
          </div>
        `,
      )
      .join('');
    blocks.push(`<div class="suggestion-section-title">Users</div>${userHtml}`);
  }

  if (!blocks.length) {
    suggestionBox.innerHTML = '<div class="no-result">No users or conversations found</div>';
    suggestionBox.style.display = 'block';
    return;
  }

  suggestionBox.innerHTML = blocks.join('');
  suggestionBox.style.display = 'block';
}

async function searchUsers(query, take = 10) {
  const res = await fetch(`${API_BASE}/users/suggest?q=${encodeURIComponent(query)}&take=${take}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
  });

  if (!res.ok) {
    throw new Error(await readApiError(res, 'Failed to search users'));
  }

  const data = await res.json();
  return data.items || [];
}

async function createDmWithUser(otherUserId, fallbackTitle = 'Direct Message') {
  const response = await fetch(`${API_BASE}/conversations/dm`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ otherUserId }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to create DM'));
  }

  const payload = unwrapApiPayload(await response.json());
  await renderConversations();
  await selectConversation(payload.id, fallbackTitle);
}

function setActionModalError(message) {
  if (!message) {
    actionModalError.textContent = '';
    actionModalError.classList.add('hidden');
    return;
  }
  actionModalError.textContent = message;
  actionModalError.classList.remove('hidden');
}

function renderActionModalSelected() {
  actionModalSelected.innerHTML = modalState.selectedUsers
    .map((u) => `<span class="user-chip">${u.name || 'User'}</span>`)
    .join('');
}

function renderActionModalResults(users, query) {
  if (!query || query.length < 2) {
    actionModalResults.innerHTML = '<div class="no-result">Type at least 2 characters to search users.</div>';
    return;
  }

  if (!users.length) {
    actionModalResults.innerHTML = '<div class="no-result">No users found.</div>';
    return;
  }

  actionModalResults.innerHTML = users
    .map(
      (u) => `
        <div class="suggestion-item" data-user-id="${u.id}">
          <img src="${u.avatar_url || 'https://placehold.co/24x24/ddd/fff?text=U'}" />
          <div>
            <div class="name">${u.name || 'User'}</div>
            <div class="sub">${u.username || u.email || ''}</div>
          </div>
        </div>
      `,
    )
    .join('');
}

function resetActionModalState() {
  modalState.mode = null;
  modalState.selectedUsers = [];
  modalState.excludedIds = new Set();
  actionModalSearch.value = '';
  actionModalField.value = '';
  actionModalFieldWrap.classList.add('hidden');
  actionModalResults.innerHTML = '<div class="no-result">Type at least 2 characters to search users.</div>';
  actionModalSelected.innerHTML = '';
  setActionModalError('');
}

function closeActionModal() {
  actionModal.classList.add('hidden');
  resetActionModalState();
}

function openActionModal({ mode, title, submitLabel, showGroupTitle = false, excludedIds = [] }) {
  modalState.mode = mode;
  modalState.selectedUsers = [];
  modalState.excludedIds = new Set(excludedIds);

  actionModalTitle.textContent = title;
  actionModalSubmit.textContent = submitLabel;
  actionModalFieldWrap.classList.toggle('hidden', !showGroupTitle);
  actionModal.classList.remove('hidden');
  actionModalSearch.value = '';
  actionModalResults.innerHTML = '<div class="no-result">Type at least 2 characters to search users.</div>';
  renderActionModalSelected();
  setActionModalError('');

  if (showGroupTitle) {
    actionModalField.focus();
  } else {
    actionModalSearch.focus();
  }
}

function upsertModalUser(user) {
  if (!user?.id) return;

  if (modalState.mode === 'new-chat') {
    modalState.selectedUsers = [user];
    renderActionModalSelected();
    return;
  }

  const exists = modalState.selectedUsers.some((u) => u.id === user.id);
  if (exists) return;
  modalState.selectedUsers.push(user);
  renderActionModalSelected();
}

async function submitActionModal() {
  try {
    setActionModalError('');

    if (modalState.mode === 'new-chat') {
      const user = modalState.selectedUsers[0];
      if (!user) {
        setActionModalError('Select one user to start a new chat.');
        return;
      }
      await createDmWithUser(user.id, user.name || 'Direct Message');
      closeActionModal();
      showMessageBox('Direct message is ready.', 'success');
      return;
    }

    if (modalState.mode === 'new-group') {
      const title = actionModalField.value.trim();
      if (!title) {
        setActionModalError('Group title is required.');
        return;
      }
      if (!modalState.selectedUsers.length) {
        setActionModalError('Select at least one member.');
        return;
      }

      const response = await fetch(`${API_BASE}/conversations/group`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title,
          memberIds: modalState.selectedUsers.map((u) => u.id),
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to create group'));
      }

      const group = unwrapApiPayload(await response.json());
      await renderConversations();
      await selectConversation(group.id, title);
      closeActionModal();
      showMessageBox('Group created successfully.', 'success');
      return;
    }

    if (modalState.mode === 'add-members') {
      if (!currentConversationId) {
        setActionModalError('Select a group first.');
        return;
      }
      if (!modalState.selectedUsers.length) {
        setActionModalError('Select at least one user to add.');
        return;
      }

      const response = await fetch(`${API_BASE}/conversations/${currentConversationId}/members`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ memberIds: modalState.selectedUsers.map((u) => u.id) }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to add members'));
      }

      await renderConversations();
      closeActionModal();
      showMessageBox('Members added successfully.', 'success');
    }
  } catch (error) {
    console.error('submitActionModal failed:', error);
    setActionModalError(error.message || 'Action failed. Try again.');
  }
}

function initActionModal() {
  actionModalClose.addEventListener('click', closeActionModal);
  actionModalCancel.addEventListener('click', closeActionModal);
  actionModalSubmit.addEventListener('click', submitActionModal);

  actionModal.addEventListener('click', (event) => {
    if (event.target === actionModal) {
      closeActionModal();
    }
  });

  actionModalResults.addEventListener('click', (event) => {
    const item = event.target.closest('.suggestion-item[data-user-id]');
    if (!item) return;

    const id = item.getAttribute('data-user-id');
    const name = item.querySelector('.name')?.textContent || 'User';
    const sub = item.querySelector('.sub')?.textContent || '';
    upsertModalUser({ id, name, username: sub });
  });

  actionModalSearch.addEventListener('input', () => {
    clearTimeout(modalSearchDebounce);
    setActionModalError('');

    modalSearchDebounce = setTimeout(async () => {
      const query = actionModalSearch.value.trim();
      if (!query || query.length < 2) {
        renderActionModalResults([], query);
        return;
      }

      try {
        const users = await searchUsers(query, 20);
        const filtered = users.filter((u) => u?.id && !modalState.excludedIds.has(u.id));
        renderActionModalResults(filtered, query);
      } catch (error) {
        console.error('modal user search failed:', error);
        actionModalResults.innerHTML = '<div class="no-result">Failed to search users.</div>';
      }
    }, 250);
  });
}

async function handleCreateNewChat() {
  openActionModal({
    mode: 'new-chat',
    title: 'Start New Chat',
    submitLabel: 'Start Chat',
    excludedIds: userId ? [userId] : [],
  });
}

async function handleCreateGroup() {
  openActionModal({
    mode: 'new-group',
    title: 'Create Group',
    submitLabel: 'Create Group',
    showGroupTitle: true,
    excludedIds: userId ? [userId] : [],
  });
}

async function handleAddMembersToCurrentGroup() {
  if (!currentConversationId) {
    showMessageBox('Select a group first.', 'error');
    return;
  }

  const conv = selectedConversationSnapshot || conversationsById.get(currentConversationId);
  if (!conv || conv.type !== 'GROUP') {
    showMessageBox('Add members is only available for group chats.', 'error');
    return;
  }

  try {
    const membersRes = await fetch(`${API_BASE}/conversations/${currentConversationId}/members`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });

    if (!membersRes.ok) {
      throw new Error(await readApiError(membersRes, 'Failed to load group members'));
    }

    const rawMembers = unwrapApiPayload(await membersRes.json());
    const members = Array.isArray(rawMembers) ? rawMembers : rawMembers?.items || [];
    const existingIds = new Set([userId]);
    members.forEach((m) => {
      if (m?.userId) existingIds.add(m.userId);
      if (m?.user?.id) existingIds.add(m.user.id);
    });

    openActionModal({
      mode: 'add-members',
      title: 'Add Members',
      submitLabel: 'Add Members',
      excludedIds: [...existingIds],
    });
  } catch (error) {
    console.error('handleAddMembersToCurrentGroup failed:', error);
    showMessageBox(error.message || 'Failed to prepare add-members flow', 'error');
  }
}

function handleLogout() {
  try {
    if (lkRoom) lkRoom.disconnect();
    if (socket) socket.disconnect();
  } catch (error) {
    console.warn('Logout cleanup warning:', error);
  }

  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  currentConversationId = null;
  selectedConversationSnapshot = null;
  conversationsById.clear();
  messagesContainer.innerHTML = '';
  conversationList.innerHTML = '';
  chatTitle.textContent = 'Select a Chat';
  if (chatAvatar) chatAvatar.src = getInitialAvatarUrl('Chat', 48);
  searchInput.value = '';
  suggestionBox.innerHTML = '';
  suggestionBox.style.display = 'none';
  hideIncomingCallBanner();
  cleanupCallUI();
  showLoginForm();
  showAuthView();
  showMessageBox('Logged out successfully.', 'success');
}

function ensureHeaderActionMenu() {
  if (headerActionMenu || !menuBtn?.parentElement) return;

  const wrapper = menuBtn.parentElement;
  wrapper.style.position = 'relative';

  const menu = document.createElement('div');
  menu.className = 'header-action-menu hidden';
  menu.innerHTML = `
    <button type="button" data-action="add-members">Add Members</button>
    <button type="button" data-action="logout">Logout</button>
  `;
  wrapper.appendChild(menu);
  headerActionMenu = menu;

  menu.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    menu.classList.add('hidden');

    if (action === 'add-members') {
      await handleAddMembersToCurrentGroup();
      return;
    }

    if (action === 'logout') {
      handleLogout();
    }
  });

  menuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    menu.classList.add('hidden');
  });
}

// --- Conversations & messages ---
async function renderConversations() {
  if (isRendering) return;
  isRendering = true;

  try {
    conversationList.innerHTML = '';
    conversationsById.clear();

    const response = await fetch(`${API_BASE}/conversations`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    const conversations = data.items || data;

    conversations.forEach((conv) => {
      conversationsById.set(conv.id, conv);
      const li = document.createElement('li');
      const convTitle = getConversationTitle(conv);
      const convPreview = getConversationLastMessagePreview(conv);
      const avatarUrl = getConversationAvatarUrl(conv);
      const avatarFallback = getAvatarFallbackTitle(convTitle);

      li.setAttribute('data-id', conv.id);
      li.classList.add('conversation-item');
      if (conv.id === currentConversationId) {
        li.classList.add('active');
      }

      const avatarEl = document.createElement('img');
      avatarEl.className = 'conversation-avatar';
      avatarEl.alt = `${convTitle} avatar`;
      avatarEl.style.width = '2rem';
      avatarEl.style.height = '2rem';
      avatarEl.style.borderRadius = '9999px';
      avatarEl.style.objectFit = 'cover';
      avatarEl.style.flexShrink = '0';
      avatarEl.src = avatarUrl || getInitialAvatarUrl(avatarFallback, 40);
      avatarEl.onerror = () => {
        avatarEl.onerror = null;
        avatarEl.src = getInitialAvatarUrl(avatarFallback, 40);
      };
      li.appendChild(avatarEl);

      const meta = document.createElement('div');
      meta.className = 'conversation-meta';

      const titleEl = document.createElement('span');
      titleEl.className = 'conversation-title';
      titleEl.textContent = convTitle;

      const previewEl = document.createElement('span');
      previewEl.className = 'conversation-preview';
      previewEl.textContent = convPreview;

      meta.appendChild(titleEl);
      meta.appendChild(previewEl);
      li.appendChild(meta);

      const members = conv.memberships ? conv.memberships.map((m) => m.userId) : [];
      const isOnline = members.some((m) => onlineUsers.has(m));
      const status = document.createElement('span');
      status.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
      li.appendChild(status);

      if (conv.unread > 0) {
        const unread = document.createElement('span');
        unread.className = 'unread-badge';
        unread.textContent = String(conv.unread);
        li.appendChild(unread);
      }

      li.addEventListener('click', () => selectConversation(conv.id, convTitle));
      conversationList.appendChild(li);
    });
  } catch (error) {
    console.error('renderConversations failed:', error);
  } finally {
    isRendering = false;
  }
}

async function selectConversation(conversationId, title) {
  currentConversationId = conversationId;
  selectedConversationSnapshot = conversationsById.get(conversationId) || null;
  updateChatHeader(selectedConversationSnapshot, title);
  clearPendingAttachments();
  attachmentInput.value = '';

  document.querySelectorAll('.conversation-item').forEach((item) => item.classList.remove('active'));
  const selectedItem = document.querySelector(`li[data-id="${conversationId}"]`);
  if (selectedItem) selectedItem.classList.add('active');

  await loadMessages(conversationId);

  if (socket) socket.emit('conversation:join', { conversationId });
  await markConversationRead(conversationId);
  await renderConversations();
  if (window.innerWidth <= 900) {
    sidebar.classList.add('sidebar-hidden');
  }
}

async function loadMessages(conversationId) {
  messagesContainer.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    const items = data.items || [];
    items.forEach((message) => {
      const messageElement = createMessageElement(message, message.senderId === userId);
      messagesContainer.appendChild(messageElement);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const lastIncoming = [...items]
      .reverse()
      .find((m) => m.senderId !== userId && m.createdAt);
    if (lastIncoming) {
      await markConversationRead(conversationId, lastIncoming.createdAt);
    }
  } catch (error) {
    showMessageBox(`Failed to load messages: ${error.message}`, 'error');
  }
}

async function sendMessage(e) {
  e.preventDefault();

  const text = messageInput.value.trim();
  if (!currentConversationId || !socket) {
    showMessageBox('Select a conversation first', 'error');
    return;
  }

  if (!text && !pendingAttachments.length) return;

  if (pendingAttachments.length) {
    const caption = text;
    messageInput.value = '';
    const filesToUpload = pendingAttachments.map((item) => item.file);
    const failedFiles = await uploadAttachments(filesToUpload, caption);

    clearPendingAttachments();
    if (failedFiles.length) {
      pendingAttachments = failedFiles.map((file) => createPendingAttachmentItem(file));
      renderPendingAttachments();
    }
    return;
  }

  messageInput.value = '';
  socket.emit('message:send', {
    conversationId: currentConversationId,
    kind: 'TEXT',
    content: { text },
  });
}

async function uploadAttachment(file, captionText = '') {
  if (!file || !currentConversationId) return null;
  if (!currentConversationId) {
    showMessageBox('Select a conversation first', 'error');
    return null;
  }

  const kind = inferMessageKindFromFile(file);
  const formData = new FormData();
  formData.append('media', file);
  formData.append('kind', kind);
  formData.append(
    'content',
    JSON.stringify({
      ...(captionText ? { text: captionText } : {}),
      fileName: file.name,
      size: file.size,
      mimeType: file.type || null,
    }),
  );

  try {
    const response = await fetch(`${API_BASE}/conversations/${currentConversationId}/messages/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, 'Failed to upload attachment'));
    }

    const payload = unwrapApiPayload(await response.json());
    const msg =
      payload?.item?.id
        ? payload.item
        : payload?.id
          ? payload
          : payload?.data?.item?.id
            ? payload.data.item
            : payload?.data?.id
              ? payload.data
              : Array.isArray(payload?.items) && payload.items[0]?.id
                ? payload.items[0]
                : null;

    if (!msg?.id) {
      throw new Error('Attachment uploaded but message payload was invalid. Please refresh and try again.');
    }

    return msg;
  } catch (error) {
    console.error('uploadAttachment failed:', error);
    throw error;
  }
}

async function uploadAttachments(files, captionText = '') {
  if (!files?.length) return [];

  showMessageBox(`Uploading ${files.length} attachment(s)...`, 'success');

  let uploadedCount = 0;
  const failedFiles = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    try {
      // Use caption only for first file, similar to chat caption behavior.
      const msg = await uploadAttachment(file, i === 0 ? captionText : '');
      if (msg?.id) {
        const exists = Array.from(messagesContainer.children).some((el) => el.dataset.messageId === msg.id);
        if (!exists) {
          const messageElement = createMessageElement(msg, msg.senderId === userId);
          messagesContainer.appendChild(messageElement);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        uploadedCount += 1;
      } else {
        failedFiles.push(file);
        showMessageBox(`Failed to upload: ${file.name}`, 'error');
      }
    } catch (error) {
      failedFiles.push(file);
      showMessageBox(error.message || `Failed to upload: ${file.name}`, 'error');
    }
  }

  attachmentInput.value = '';
  await renderConversations();
  if (uploadedCount > 0) {
    showMessageBox(`${uploadedCount} attachment(s) sent`, 'success');
  }
  return failedFiles;
}

// --- Search / DM creation ---
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  filterConversationList(q);
  clearTimeout(searchDebounce);

  if (!q) {
    suggestionBox.innerHTML = '';
    suggestionBox.style.display = 'none';
    return;
  }

  searchDebounce = setTimeout(async () => {
    const localQuery = searchInput.value.trim();
    if (!localQuery) return;

    try {
      const conversationMatches = Array.from(conversationsById.values())
        .map((conv) => ({
          id: conv.id,
          title: getConversationTitle(conv),
        }))
        .filter((conv) => conv.title.toLowerCase().includes(localQuery.toLowerCase()))
        .slice(0, 8);

      let users = [];
      if (localQuery.length >= 2) {
        users = await searchUsers(localQuery, 10);
      }

      // Avoid stale renders when user types quickly.
      if (searchInput.value.trim() !== localQuery) return;

      renderSearchSuggestions({
        query: localQuery,
        conversations: conversationMatches,
        users,
      });
    } catch (err) {
      console.error('Search error:', err);
      suggestionBox.innerHTML = '<div class="no-result">Error fetching users</div>';
      suggestionBox.style.display = 'block';
    }
  }, 250);
});

suggestionBox.addEventListener('click', async (event) => {
  const item = event.target.closest('.suggestion-item');
  if (!item) return;

  const type = item.getAttribute('data-type');
  try {
    if (type === 'conversation') {
      const id = item.getAttribute('data-id');
      const title = item.getAttribute('data-title') || 'Conversation';
      await selectConversation(id, title);
    } else if (type === 'user') {
      const id = item.getAttribute('data-id');
      const title = item.querySelector('.name')?.textContent || 'Direct Message';
      await createDmWithUser(id, title);
    }

    suggestionBox.innerHTML = '';
    suggestionBox.style.display = 'none';
    searchInput.value = '';
  } catch (error) {
    showMessageBox(error.message || 'Action failed', 'error');
  }
});

searchInput.addEventListener('keydown', async (event) => {
  if (event.key !== 'Enter') return;

  const firstSuggestion = suggestionBox.querySelector('.suggestion-item');
  if (!firstSuggestion) return;

  event.preventDefault();
  firstSuggestion.click();
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.sidebar-search')) {
    suggestionBox.style.display = 'none';
  }
});

// --- LiveKit Calling (1:1 + Group, Audio + Video) ---
function showCallOverlay(statusText = 'Connecting...') {
  callOverlay.classList.remove('hidden');
  callStatusEl.textContent = statusText;
}

function hideCallOverlay() {
  callOverlay.classList.add('hidden');
}

async function startCallFlow(kind = 'VIDEO') {
  if (!currentConversationId) {
    showMessageBox('Select a conversation first', 'error');
    return;
  }

  currentCallKind = kind;

  try {
    showCallOverlay(`Starting ${kind.toLowerCase()} call...`);

    await fetch(`${API_BASE}/rtc/conversations/${currentConversationId}/start`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ kind }),
    });

    const tokenResp = await fetch(`${API_BASE}/rtc/conversations/${currentConversationId}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });

    if (!tokenResp.ok) throw new Error('Failed to get token');

    const { success, data } = await tokenResp.json();
    if (!success) throw new Error('Token API returned error');

    const { token, url, roomName } = data;
    callStatusEl.textContent = `Connecting to ${roomName}`;
    await connectLiveKit(url, token, kind);
  } catch (error) {
    console.error('Call start error:', error);
    showMessageBox(getFriendlyCallError(error, 'Failed to start call'), 'error');
    hideCallOverlay();
  }
}

async function joinIncomingCall(call) {
  const kind = call.kind || 'VIDEO';
  const convId = call.conversationId;
  if (!convId) return;

  try {
    currentCallKind = kind;

    const convItem = conversationList.querySelector(`li[data-id="${convId}"]`);
    if (convItem) {
      const title = convItem.querySelector('span')?.textContent || 'Conversation';
      await selectConversation(convId, title);
    } else {
      currentConversationId = convId;
    }

    showCallOverlay(`Joining ${kind.toLowerCase()} call...`);

    await fetch(`${API_BASE}/rtc/conversations/${convId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });

    const tokenResp = await fetch(`${API_BASE}/rtc/conversations/${convId}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    if (!tokenResp.ok) throw new Error('Failed to get token');

    const { success, data } = await tokenResp.json();
    if (!success) throw new Error('Token API returned error');

    await connectLiveKit(data.url, data.token, kind);
  } catch (error) {
    console.error('joinIncomingCall failed:', error);
    showMessageBox(getFriendlyCallError(error, 'Failed to join incoming call'), 'error');
    hideCallOverlay();
  }
}

async function connectLiveKit(serverUrl, accessToken, kind) {
  if (lkRoom) await leaveCall();

  const LK = window.LivekitClient || window.livekitClient || window.livekit || window.LiveKitClient || {};

  let connectFn = LK.connect;
  if (typeof connectFn !== 'function' && typeof LK.Room === 'function') {
    connectFn = async (url, token, opts) => {
      const room = new LK.Room(opts);
      await room.connect(url, token);
      return room;
    };
  }

  if (typeof connectFn !== 'function') {
    showMessageBox('LiveKit SDK not loaded', 'error');
    hideCallOverlay();
    return;
  }

  try {
    lkRoom = await connectFn(serverUrl, accessToken, { autoSubscribe: true });
  } catch (error) {
    hideCallOverlay();
    throw error;
  }

  const events = LK.RoomEvent || {};
  lkRoom.on(events.ParticipantConnected || 'participantConnected', (p) => {
    callStatusEl.textContent = `${p.identity} joined`;
  });
  lkRoom.on(events.ParticipantDisconnected || 'participantDisconnected', (p) => {
    removeRemoteParticipant(p.identity);
    callStatusEl.textContent = `${p.identity} left`;
  });
  lkRoom.on(events.TrackSubscribed || 'trackSubscribed', (track, _pub, participant) => {
    attachRemoteTrack(track, participant.identity);
  });
  lkRoom.on(events.TrackUnsubscribed || 'trackUnsubscribed', (track, _pub, participant) => {
    detachRemoteTrack(track, participant.identity);
  });
  lkRoom.on(events.Disconnected || 'disconnected', cleanupCallUI);

  // Prefer participant convenience methods for mic/cam controls
  const localParticipant = lkRoom.localParticipant;
  try {
    await localParticipant.setMicrophoneEnabled(true);
  } catch (error) {
    micEnabled = false;
    toggleMicBtn.textContent = 'Unmute';
    console.warn('Microphone unavailable:', error);
    showMessageBox(getFriendlyCallError(error, 'Microphone unavailable, joined in listen-only mode'), 'error');
  }

  if (kind === 'VIDEO') {
    try {
      await localParticipant.setCameraEnabled(true);
      localVideoEl.style.display = 'block';
      toggleCamBtn.style.display = 'inline-flex';
    } catch (error) {
      camEnabled = false;
      toggleCamBtn.textContent = 'Camera On';
      localVideoEl.style.display = 'none';
      toggleCamBtn.style.display = 'inline-flex';
      console.warn('Camera unavailable:', error);
      showMessageBox(getFriendlyCallError(error, 'Camera unavailable, continuing with audio only'), 'error');
    }
  } else {
    await localParticipant.setCameraEnabled(false);
    localVideoEl.style.display = 'none';
    toggleCamBtn.style.display = 'none';
  }

  // Attach local video preview for video calls
  if (kind === 'VIDEO') {
    const localVideoPub = Array.from(localParticipant.videoTrackPublications.values())[0];
    if (localVideoPub?.track) {
      localVideoPub.track.attach(localVideoEl);
    }
  }

  callStatusEl.textContent = `${kind} call connected`;
  wireCallButtons();
}

function attachRemoteTrack(track, identity) {
  if (track.kind !== 'video' && track.kind !== 'audio') return;

  let wrapper = document.getElementById(`remote-${identity}`);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = `remote-${identity}`;
    wrapper.className = 'remote-wrapper';

    remoteVideosEl.appendChild(wrapper);
  }

  if (track.kind === 'video') {
    let videoEl = wrapper.querySelector('video');
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      wrapper.appendChild(videoEl);
    }
    track.attach(videoEl);
    return;
  }

  let audioEl = wrapper.querySelector('audio');
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    wrapper.appendChild(audioEl);
  }

  track.attach(audioEl);
  // Best effort autoplay to avoid silent remote audio in some browsers.
  const playPromise = audioEl.play?.();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch((error) => console.warn('Remote audio autoplay blocked:', error));
  }
}

function detachRemoteTrack(track, identity) {
  const wrapper = document.getElementById(`remote-${identity}`);
  if (!wrapper) return;

  if (!track || (track.kind !== 'video' && track.kind !== 'audio')) {
    wrapper.remove();
    return;
  }

  const mediaEl = wrapper.querySelector(track.kind === 'video' ? 'video' : 'audio');
  if (mediaEl) mediaEl.remove();
  if (!wrapper.querySelector('video') && !wrapper.querySelector('audio')) {
    wrapper.remove();
  }
}

function removeRemoteParticipant(identity) {
  detachRemoteTrack(null, identity);
}

function wireCallButtons() {
  toggleMicBtn.onclick = async () => {
    if (!lkRoom?.localParticipant) return;
    micEnabled = !micEnabled;
    try {
      await lkRoom.localParticipant.setMicrophoneEnabled(micEnabled);
    } catch (error) {
      micEnabled = !micEnabled;
      showMessageBox(getFriendlyCallError(error, 'Could not toggle microphone'), 'error');
      return;
    }
    toggleMicBtn.textContent = micEnabled ? 'Mute' : 'Unmute';
  };

  toggleCamBtn.onclick = async () => {
    if (!lkRoom?.localParticipant) return;
    camEnabled = !camEnabled;
    try {
      await lkRoom.localParticipant.setCameraEnabled(camEnabled);
    } catch (error) {
      camEnabled = !camEnabled;
      showMessageBox(getFriendlyCallError(error, 'Could not toggle camera'), 'error');
      return;
    }
    toggleCamBtn.textContent = camEnabled ? 'Camera Off' : 'Camera On';
  };

  hangupBtn.onclick = () => leaveCall();
}

async function leaveCall() {
  const convId = currentConversationId;
  try {
    if (lkRoom) lkRoom.disconnect();
    if (convId) {
      await fetch(`${API_BASE}/rtc/conversations/${convId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
    }
  } catch (error) {
    console.warn('Leave call warning:', error);
  } finally {
    cleanupCallUI();
  }
}

function cleanupCallUI() {
  remoteVideosEl.innerHTML = '';
  localVideoEl.srcObject = null;
  hideCallOverlay();
  lkRoom = null;
  micEnabled = true;
  camEnabled = true;
  currentCallKind = 'VIDEO';
  toggleMicBtn.textContent = 'Mute';
  toggleCamBtn.textContent = 'Camera Off';
}

function handlePlaceholderFeature(feature) {
  showMessageBox(`${feature} is not implemented in this demo.`, 'error');
}

// --- Event listeners ---
showRegisterBtn.addEventListener('click', showRegisterForm);
showLoginBtn.addEventListener('click', showLoginForm);
loginBtn.addEventListener('click', handleLogin);
registerBtn.addEventListener('click', handleRegister);
sendMessageBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('input', () => {
  sendTypingStatus(messageInput.value.trim().length > 0);
});

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('sidebar-hidden');
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) {
    sidebar.classList.remove('sidebar-hidden');
  }
});

incomingCallRejectBtn.addEventListener('click', () => {
  hideIncomingCallBanner();
});

incomingCallAcceptBtn.addEventListener('click', async () => {
  const call = pendingIncomingCall;
  hideIncomingCallBanner();
  if (call) {
    await joinIncomingCall(call);
  }
});

audioCallBtn.addEventListener('click', () => startCallFlow('AUDIO'));
videoCallBtn.addEventListener('click', () => startCallFlow('VIDEO'));
newChatBtn.addEventListener('click', () => handleCreateNewChat());
newGroupBtn.addEventListener('click', () => handleCreateGroup());
attachBtn.addEventListener('click', () => {
  if (!currentConversationId) {
    showMessageBox('Select a conversation first', 'error');
    return;
  }
  attachmentInput.setAttribute('multiple', 'multiple');
  attachmentInput.click();
});

attachmentInput.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const existing = new Set(pendingAttachments.map((item) => item.id));
  files.forEach((file) => {
    const id = pendingAttachmentId(file);
    if (existing.has(id)) return;
    pendingAttachments.push(createPendingAttachmentItem(file));
    existing.add(id);
  });

  renderPendingAttachments();
  showMessageBox(
    `${pendingAttachments.length} file(s) selected. Press send to upload ${messageInput.value.trim() ? 'with caption' : ''}.`,
    'success',
  );
});

pendingAttachmentsEl.addEventListener('click', (event) => {
  const removeBtn = event.target.closest('.pending-remove');
  if (!removeBtn) return;

  const index = Number(removeBtn.getAttribute('data-index'));
  if (!Number.isInteger(index) || index < 0 || index >= pendingAttachments.length) return;

  const [removed] = pendingAttachments.splice(index, 1);
  if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  renderPendingAttachments();
});

ensureHeaderActionMenu();
initActionModal();

// --- Boot ---
window.onload = async () => {
  const token = localStorage.getItem('access_token');

  if (!token) {
    showAuthView();
    return;
  }

  try {
    const decoded = JSON.parse(atob(token.split('.')[1]));
    userId = decoded.sub;
    userIdDisplay.textContent = `User ID: ${userId}`;
    showChatView();
    await renderConversations();
    connectSocket();
  } catch (error) {
    console.error('Token decode failed:', error);
    localStorage.removeItem('access_token');
    showAuthView();
  }
};
