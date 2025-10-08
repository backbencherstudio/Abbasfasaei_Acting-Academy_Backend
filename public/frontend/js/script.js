// --- Configuration ---
const SOCKET_URL = 'http://127.0.0.1:4000/ws'; // CHANGE THIS TO YOUR NESTJS BACKEND URL

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
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const userIdDisplay = document.getElementById('user-id-display');
const typingIndicator = document.getElementById('typing-indicator');

// Placeholder feature buttons
const audioCallBtn = document.getElementById('audio-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
// Call UI elements
const callOverlay = document.getElementById('call-overlay');
const localVideoEl = document.getElementById('local-video');
const remoteVideosEl = document.getElementById('remote-videos');
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');
const hangupBtn = document.getElementById('hangup-btn');
const callStatusEl = document.getElementById('call-status');
const newChatBtn = document.getElementById('new-chat-btn');
const newGroupBtn = document.getElementById('new-group-btn');
const attachBtn = document.getElementById('attach-btn');

const searchInput = document.querySelector('.sidebar-search input');
const suggestionBox = document.querySelector('.sidebar-search .suggestion-box');

// --- App State ---
let socket;
let userId = null;
let currentConversationId = null;
let typingTimeout = null;
const onlineUsers = new Set();
let isSending = false;
let searchDebounce;
let isRendering = false;
// LiveKit room & state
let lkRoom = null;
let micEnabled = true;
let camEnabled = true;

console.log('online users:', onlineUsers);

// --- UI State Management ---
const showMessageBox = (message, type = 'success') => {
  messageBox.textContent = message;
  messageBox.classList.remove('error', 'success');
  messageBox.classList.add(type);
  messageBox.style.display = 'block';
};

const hideMessageBox = () => {
  messageBox.style.display = 'none';
};

const showLoginForm = () => {
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
  hideMessageBox();
};

const showRegisterForm = () => {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
  hideMessageBox();
};

const showChatView = () => {
  authView.style.display = 'none';
  chatView.style.display = 'flex';
};

const showAuthView = () => {
  authView.style.display = 'flex';
  chatView.style.display = 'none';
};

// --- Authentication Functions (Simulated) ---
const handleLogin = async () => {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value; // keep original case for password
  try {
    const response = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const rawText = await response.text();
    let data;
    console.log('rawText:', rawText);
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { success: false, message: rawText };
    }

    if (!response.ok || !data.success) {
      // Distinguish likely causes
      let userMsg = 'Login failed';
      if (response.status === 401) {
        userMsg = 'Invalid email or password';
      } else if (data?.message?.message) {
        userMsg = data.message.message;
      } else if (typeof data.message === 'string') {
        userMsg = data.message;
      }
      console.warn('Login debug:', {
        status: response.status,
        payloadSent: { email },
        server: data,
      });
      showMessageBox(userMsg, 'error');
      return;
    }

    // Backend login response does not include userId directly, decode from access token
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
    } catch (e) {
      console.warn('Failed decoding JWT', e);
    }
    showMessageBox('Login successful!');
    showChatView();
    await renderConversations();
    connectSocket();
  } catch (error) {
    console.error('Error logging in:', error);
    showMessageBox('Login failed. Please try again.', 'error');
  }
};

const handleRegister = async () => {
  const email = registerEmailInput.value;
  const password = registerPasswordInput.value;

  const response = await fetch('http://localhost:4000/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Registration failed: ${errorData}`);
  }

  const data = await response.json();

  if (data.success) {
    userId = data.userId;
    showMessageBox('Registration successful! Logging you in...', 'success');
  } else {
    showMessageBox(data.message, 'error');
  }
};

// --- WebSocket Connection ---
const connectSocket = () => {
  if (socket && socket.connected) {
    console.log('WebSocket already connected.');
    return;
  }

  const token = localStorage.getItem('access_token');
  socket = io(SOCKET_URL, {
    auth: { token },
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server.');
    userIdDisplay.textContent = `User ID: ${userId}`;
    showChatView();
    renderConversations();
  });

  socket.on('connection:ok', (data) => {
    console.log('Connection acknowledged by server:', data.userId);
  });

  socket.on('presence:update', (data) => {
    console.log('Presence update:', data);

    const { userId, online } = data;

    if (online) {
      onlineUsers.add(userId);
    } else {
      onlineUsers.delete(userId);
    }
    renderConversations();
  });

  console.log('online users:', onlineUsers);

  socket.on('connection:error', (data) => {
    console.error('Connection error:', data.message);
    showMessageBox(`Connection error: ${data.message}`, 'error');
    socket.disconnect();
    showAuthView();
  });

  // Listen for message:ack or message:new to update UI
  socket.on('message:new', (msg) => {
    console.log('New message received:', msg);

    // Check if the message is already in the UI to prevent duplication
    const existingMessages = Array.from(messagesContainer.children);
    const isMessageExist = existingMessages.some(
      (messageElement) => messageElement.dataset.messageId === msg.id,
    );

    if (!isMessageExist && msg.conversationId === currentConversationId) {
      const isSentByMe = msg.senderId === userId;
      const messageElement = createMessageElement(msg, isSentByMe);
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });

  // --- Typing Indicator ---
  socket.on('typing', (data) => {
    console.log(`${data.userId} is typing...`);
    if (data.userId !== userId) {
      typingIndicator.textContent = `${data.userName} is typing...`;
      typingIndicator.style.display = 'block';

      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        typingIndicator.style.display = 'none';
      }, 2000);
    }
  });
};

// --- Send Typing Event ---
const sendTypingStatus = (on) => {
  if (socket && currentConversationId) {
    socket.emit('typing', { conversationId: currentConversationId, on });
  }
};

// --- UI Rendering Functions ---

const renderConversations = async () => {
  if (isRendering) return; // Prevent concurrent renders
  isRendering = true;

  conversationList.innerHTML = ''; // Clear existing conversations

  console.log('hit in renderConversations');
  const response = await fetch('http://localhost:4000/api/conversations', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to fetch conversations: ${errorData}`);
  }

  const renderedConversationIds = new Set();
  const data = await response.json();

  console.log('conversations data:', data);

  const conversations = data.items || data;

  // Using a Set to ensure we are not rendering duplicate conversations
  conversations.forEach((conv) => {
    if (renderedConversationIds.has(conv.id)) return;
    renderedConversationIds.add(conv.id);

    const li = document.createElement('li');

    // Improved logic for conversation title
    let convTitle;
    if (
      conv.creator_id === userId ||
      conv.senderId === userId ||
      conv.senderTitle === userId
    ) {
      convTitle = conv.receiverTitle;
    } else {
      convTitle = conv.senderTitle;
    }

    li.textContent = convTitle || conv.title || 'Untitled Conversation';
    li.setAttribute('data-id', conv.id);
    li.classList.add('conversation-item');

    const members = conv.memberships
      ? conv.memberships.map((m) => m.userId)
      : [];

    const isOnline =
      onlineUsers.has(convTitle) || members.some((m) => onlineUsers.has(m));
    const statusIndicator = document.createElement('span');
    statusIndicator.classList.add('status-indicator');
    statusIndicator.style.backgroundColor = isOnline ? 'green' : 'gray';
    li.appendChild(statusIndicator);

    li.addEventListener('click', () =>
      selectConversation(
        conv.id,
        convTitle || conv.title || 'Untitled Conversation',
      ),
    );
    conversationList.appendChild(li);
  });

  isRendering = false;
};

// --- Handle conversation selection and load messages ---
const selectConversation = async (conversationId, title) => {
  currentConversationId = conversationId;
  chatTitle.textContent = title;

  // Highlight the selected conversation
  document
    .querySelectorAll('.conversation-item')
    .forEach((item) => item.classList.remove('active'));

  const selectedItem = document.querySelector(
    `li[data-id="${conversationId}"]`,
  );
  if (selectedItem) {
    selectedItem.classList.add('active');
  }

  loadMessages(conversationId);

  if (socket) {
    socket.emit('conversation:join', { conversationId });
  }

  sidebar.classList.toggle('sidebar-hidden', true);
};

// --- Fetch messages for the selected conversation ---
const loadMessages = async (conversationId) => {
  messagesContainer.innerHTML = '';

  const response = await fetch(
    `http://localhost:4000/api/conversations/${conversationId}/messages`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
    },
  );

  if (!response.ok) {
    const errorData = await response.text();
    showMessageBox(`Failed to load messages: ${errorData}`, 'error');
    return;
  }

  const data = await response.json();
  data.items.forEach((message) => {
    const isSentByMe = message.senderId === userId;
    const messageElement = createMessageElement(message, isSentByMe);
    messagesContainer.appendChild(messageElement);
  });

  // Scroll to the bottom of the messages container
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

// --- Create a message element ---
const createMessageElement = (message, isSentByMe) => {
  const div = document.createElement('div');
  const time = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  div.classList.add(isSentByMe ? 'message-sent' : 'message-received');

  let htmlContent = '';
  if (!isSentByMe) {
    htmlContent += `<img src="https://placehold.co/40x40/d1d5db/white?text=${message.senderId.charAt(0).toUpperCase()}" alt="Avatar" style="width: 2.5rem; height: 2.5rem; border-radius: 9999px; object-fit: cover;">`;
  }

  htmlContent += `<div class="message-bubble ${isSentByMe ? 'sent' : 'received'}">`;
  htmlContent += `<p class="message-text">${message.content.text}</p>`;
  htmlContent += `<p class="message-time">${time}</p>`;
  htmlContent += `</div>`;
  div.innerHTML = htmlContent;

  return div;
};

// ---------- search for sendMessage function ----------
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearTimeout(searchDebounce);

  if (q.length < 2) {
    suggestionBox.innerHTML = '';
    suggestionBox.style.display = 'none'; // hide when empty
    return;
  }

  searchDebounce = setTimeout(async () => {
    try {
      const res = await fetch(
        `http://localhost:4000/api/users/suggest?q=${encodeURIComponent(q)}&take=10`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        },
      );

      if (!res.ok) {
        suggestionBox.innerHTML =
          '<div class="no-result">Error fetching users</div>';
        suggestionBox.style.display = 'block';
        return;
      }

      const data = await res.json();
      console.log('suggestion response:', data); // 🔥 check data in console

      if (!data.items || data.items.length === 0) {
        suggestionBox.innerHTML = '<div class="no-result">No users found</div>';
        suggestionBox.style.display = 'block';
      } else {
        suggestionBox.innerHTML = data.items
          .map(
            (u) => `
              <div class="suggestion-item" data-id="${u.id}">
                <img src="${u.avatar_url || 'https://placehold.co/24x24/ddd/fff?text=U'}" />
                <div>
                  <div class="name">${u.name}</div>
                  <div class="sub">${u.username || ''}</div>
                </div>
              </div>
            `,
          )
          .join('');
        suggestionBox.style.display = 'block'; // ✅ SHOW RESULTS
      }

      // add click event
      suggestionBox.querySelectorAll('.suggestion-item').forEach((item) => {
        item.addEventListener('click', async () => {
          const otherUserId = item.getAttribute('data-id');
          const response = await fetch(
            'http://localhost:4000/api/conversations/dm',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('access_token')}`,
              },
              body: JSON.stringify({ otherUserId }),
            },
          );

          const conversation = await response.json();
          selectConversation(
            conversation.id,
            item.querySelector('.name').textContent,
          );
          suggestionBox.innerHTML = '';
          suggestionBox.style.display = 'none'; 
        });
      });
    } catch (err) {
      console.error('Search error:', err);
    }
  }, 250);
});

// --- Message Sending Function ---

const sendMessage = (e) => {
  e.preventDefault();
  if (isSending) return;
  const messageContent = messageInput.value.trim();
  if (!messageContent || !currentConversationId || !socket) return;

  isSending = true;

  const messagePayload = {
    conversationId: currentConversationId,
    kind: 'TEXT',
    content: { text: messageContent },
    timestamp: Date.now(),
    senderId: userId,
  };

  console.log('msg hit');

  // Only emit via WebSocket, do NOT call REST API for sending messages!
  socket.emit('message:send', {
    conversationId: currentConversationId,
    kind: 'TEXT',
    content: { text: messageContent },
  });

  // Optimistically add the message to the UI (sender’s side)
  const messageElement = createMessageElement(messagePayload, true);
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  messageInput.value = '';

  socket.on('message:ack', (data) => {
    const messageId = data.messageId;
    updateMessageWithId(messageId, messageElement);
    isSending = false;
  });
};

// Update the message with the server's acknowledged message ID or other details
const updateMessageWithId = (messageId, messageElement) => {
  messageElement.setAttribute('data-message-id', messageId);
  // Optionally, add a success indicator
  messageElement.classList.add('message-sent');
};

const handleTyping = () => {
  // Clear previous timeout to avoid multiple emissions
  clearTimeout(typingTimeout);
  socket.emit('typing', { conversationId: currentConversationId, on: true });
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { conversationId: currentConversationId, on: false });
  }, 2000);
};

const handlePlaceholderFeature = (feature) => {
  showMessageBox(`${feature} is not implemented in this demo.`, 'info');
};

// --- Event Listeners ---
showRegisterBtn.addEventListener('click', showRegisterForm);
showLoginBtn.addEventListener('click', showLoginForm);
loginBtn.addEventListener('click', handleLogin);
registerBtn.addEventListener('click', handleRegister);
sendMessageBtn.addEventListener('click', sendMessage);

// Send typing event when the user is typing
messageInput.addEventListener('input', () => {
  if (messageInput.value.trim().length > 0) {
    sendTypingStatus(true); // Send typing event to the server
  } else {
    sendTypingStatus(false); // Send typing stop event to the server
  }
});

// Send typing event to the server
// (Removed duplicate declaration of sendTypingStatus)

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('sidebar-hidden');
});

// Call buttons
audioCallBtn.addEventListener('click', () => startCallFlow('AUDIO'));
videoCallBtn.addEventListener('click', () => startCallFlow('VIDEO'));
newChatBtn.addEventListener('click', () =>
  handlePlaceholderFeature('New Chat'),
);
newGroupBtn.addEventListener('click', () =>
  handlePlaceholderFeature('New Group Chat'),
);
attachBtn.addEventListener('click', () =>
  handlePlaceholderFeature('File Attachment'),
);

// ---------------- RTC / LiveKit Integration ----------------
async function startCallFlow(kind = 'VIDEO') {
  if (!currentConversationId) {
    showMessageBox('Select a conversation first', 'error');
    return;
  }
  try {
    showCallOverlay('Requesting token...');
    // Request token (auto start if not active)
    const tokenResp = await fetch(
      `http://localhost:4000/api/rtc/conversations/${currentConversationId}/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      },
    );
    if (!tokenResp.ok) throw new Error('Failed to get token');
    const { success, data } = await tokenResp.json();
    if (!success) throw new Error('Token API returned error');
    const { token, url, roomName } = data;
    if (url.includes('your-livekit-host')) {
      showMessageBox('Server not configured for LiveKit yet. Set LIVEKIT_URL in backend .env to your instance (e.g. ws://localhost:7880) and restart.', 'error');
      hideCallOverlay();
      return;
    }
    callStatusEl.textContent = `Connecting to ${roomName}...`;
    await connectLiveKit(url, token, kind);
  } catch (e) {
    console.error('Call start error:', e);
    showMessageBox('Failed to start call', 'error');
    hideCallOverlay();
  }
}

function showCallOverlay(statusText = 'Connecting...') {
  if (callOverlay) {
    callOverlay.classList.remove('hidden');
    callStatusEl.textContent = statusText;
  }
}

function hideCallOverlay() {
  if (callOverlay) callOverlay.classList.add('hidden');
}

async function connectLiveKit(serverUrl, accessToken, kind) {
  if (lkRoom) {
    // Already connected, hang up first
    await leaveCall();
  }
  const LK =
    window.LivekitClient ||
    window.livekitClient ||
    window.livekit ||
    window.LiveKitClient ||
    {};

  // Fallback factory: if connect() helper missing but Room exists, recreate it.
  let connectFn = LK.connect;
  if (typeof connectFn !== 'function' && typeof LK.Room === 'function') {
    console.warn('[LiveKit] connect() helper missing on global. Using fallback Room constructor.');
    connectFn = async (url, token, opts) => {
      const room = new LK.Room(opts);
      await room.connect(url, token);
      return room;
    };
  }

  // Provide track creation fallbacks (older/newer SDK discrepancies)
  let createLocalAudioTrack = LK.createLocalAudioTrack;
  let createLocalVideoTrack = LK.createLocalVideoTrack;
  const createLocalTracks = LK.createLocalTracks; // alternative API

  if (typeof connectFn !== 'function') {
    console.error('LiveKit SDK connect() not found even after fallback. Global keys:', Object.keys(LK));
    showMessageBox('LiveKit SDK not loaded (check script tag or version)', 'error');
    hideCallOverlay();
    return;
  }

  if (typeof createLocalAudioTrack !== 'function' && typeof createLocalTracks === 'function') {
    console.warn('[LiveKit] createLocalAudioTrack() missing, deriving from createLocalTracks().');
    createLocalAudioTrack = async () => {
      const tracks = await createLocalTracks({ audio: true });
      return tracks.find((t) => t.kind === 'audio');
    };
  }
  if (kind === 'VIDEO' && typeof createLocalVideoTrack !== 'function' && typeof createLocalTracks === 'function') {
    console.warn('[LiveKit] createLocalVideoTrack() missing, deriving from createLocalTracks().');
    createLocalVideoTrack = async () => {
      const tracks = await createLocalTracks({ video: true });
      return tracks.find((t) => t.kind === 'video');
    };
  }

  lkRoom = await connectFn(serverUrl, accessToken, { autoSubscribe: true });
  callStatusEl.textContent = 'Connected';

  // Event listeners
  lkRoom.on('participantConnected', (p) =>
    console.log('participantConnected', p.identity),
  );
  lkRoom.on('participantDisconnected', (p) =>
    removeRemoteParticipant(p.identity),
  );
  lkRoom.on('trackSubscribed', (track, pub, participant) => {
    attachRemoteTrack(track, participant.identity);
  });
  lkRoom.on('trackUnsubscribed', (track, pub, participant) => {
    detachRemoteTrack(participant.identity);
  });
  lkRoom.on('disconnected', () => {
    cleanupCallUI();
  });

  // Publish local tracks
  try {
    if (typeof createLocalAudioTrack === 'function') {
      const audioTrack = await createLocalAudioTrack();
      if (audioTrack) await lkRoom.localParticipant.publishTrack(audioTrack);
    } else {
      console.warn('[LiveKit] No audio track API available. Audio will be disabled.');
    }
    if (kind === 'VIDEO') {
      if (typeof createLocalVideoTrack === 'function') {
        const videoTrack = await createLocalVideoTrack();
        if (videoTrack) {
          localVideoEl.srcObject = videoTrack.mediaStreamTrack
            ? new MediaStream([videoTrack.mediaStreamTrack])
            : null;
          localVideoEl.style.display = 'block';
          toggleCamBtn.style.display = 'inline-flex';
          await lkRoom.localParticipant.publishTrack(videoTrack);
        }
      } else {
        console.warn('[LiveKit] No video track API available. Proceeding audio-only.');
        localVideoEl.srcObject = null;
        localVideoEl.style.display = 'none';
        toggleCamBtn.style.display = 'none';
      }
    } else {
      // Audio only call
      localVideoEl.srcObject = null;
      localVideoEl.style.display = 'none';
      toggleCamBtn.style.display = 'none';
    }
  } catch (trackErr) {
    console.error('Error publishing local tracks:', trackErr);
    showMessageBox('Failed to capture local media (permissions?)', 'error');
  }

  // Show existing participants' tracks (if they were already in the room)
  try {
    const participantCollection =
      lkRoom.participants || // modern SDK Map
      lkRoom.remoteParticipants || // possible alternate naming
      null;

    if (participantCollection) {
      // If it's a Map (has forEach) use directly; if it's a plain object, iterate values
      if (typeof participantCollection.forEach === 'function') {
        participantCollection.forEach((participant) => {
          if (!participant || !participant.tracks) return;
            participant.tracks.forEach((pub) => {
              if (pub && pub.track) {
                attachRemoteTrack(pub.track, participant.identity);
              }
            });
        });
      } else if (typeof participantCollection === 'object') {
        Object.values(participantCollection).forEach((participant) => {
          if (!participant || !participant.tracks) return;
          // tracks could be a Map or array depending on SDK version
          const trackIter = typeof participant.tracks.forEach === 'function'
            ? participant.tracks
            : Array.isArray(participant.tracks)
              ? participant.tracks
              : [];
          trackIter.forEach((pub) => {
            if (pub && pub.track) {
              attachRemoteTrack(pub.track, participant.identity);
            }
          });
        });
      }
    } else {
      console.debug('[LiveKit] No participant collection found on room; keys:', Object.keys(lkRoom || {}));
    }
  } catch (e) {
    console.warn('[LiveKit] Failed enumerating existing participants:', e);
  }

  wireCallButtons();
}

function attachRemoteTrack(track, identity) {
  if (track.kind === 'video' || track.kind === 'audio') {
    let wrapper = document.getElementById(`remote-${identity}`);
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = `remote-${identity}`;
      wrapper.className = 'remote-wrapper';
      const vid = document.createElement(
        track.kind === 'video' ? 'video' : 'audio',
      );
      vid.autoplay = true;
      if (track.kind === 'video') vid.playsInline = true;
      wrapper.appendChild(vid);
      remoteVideosEl.appendChild(wrapper);
    }
    const mediaEl = wrapper.querySelector(
      track.kind === 'video' ? 'video' : 'audio',
    );
    track.attach(mediaEl);
  }
}

function detachRemoteTrack(identity) {
  const wrapper = document.getElementById(`remote-${identity}`);
  if (wrapper) wrapper.remove();
}

function removeRemoteParticipant(identity) {
  detachRemoteTrack(identity);
}

function wireCallButtons() {
  toggleMicBtn.onclick = () => {
    micEnabled = !micEnabled;
    const lp = lkRoom && lkRoom.localParticipant;
    if (!lp) {
      console.warn('[LiveKit] No localParticipant when toggling mic');
      return;
    }
    const audioTracks = lp.audioTracks || lp.tracks || [];
    // audioTracks may be a Map, array, or object
    if (typeof audioTracks.forEach === 'function') {
      audioTracks.forEach((pub) => {
        if (pub && pub.track) (micEnabled ? pub.track.unmute() : pub.track.mute());
      });
    } else if (Array.isArray(audioTracks)) {
      audioTracks.forEach((pub) => {
        if (pub && pub.track) (micEnabled ? pub.track.unmute() : pub.track.mute());
      });
    } else {
      Object.values(audioTracks).forEach((pub) => {
        if (pub && pub.track) (micEnabled ? pub.track.unmute() : pub.track.mute());
      });
    }
    toggleMicBtn.textContent = micEnabled ? 'Mute' : 'Unmute';
  };
  toggleCamBtn.onclick = () => {
    camEnabled = !camEnabled;
    const lp = lkRoom && lkRoom.localParticipant;
    if (!lp) {
      console.warn('[LiveKit] No localParticipant when toggling camera');
      return;
    }
    const videoTracks = lp.videoTracks || lp.tracks || [];
    if (typeof videoTracks.forEach === 'function') {
      videoTracks.forEach((pub) => {
        if (pub && pub.track) (camEnabled ? pub.track.unmute() : pub.track.mute());
      });
    } else if (Array.isArray(videoTracks)) {
      videoTracks.forEach((pub) => {
        if (pub && pub.track) (camEnabled ? pub.track.unmute() : pub.track.mute());
      });
    } else {
      Object.values(videoTracks).forEach((pub) => {
        if (pub && pub.track) (camEnabled ? pub.track.unmute() : pub.track.mute());
      });
    }
    toggleCamBtn.textContent = camEnabled ? 'Camera Off' : 'Camera On';
  };
  hangupBtn.onclick = () => leaveCall();
}

async function leaveCall() {
  try {
    if (lkRoom) {
      lkRoom.disconnect();
    }
    if (currentConversationId) {
      // Inform backend (soft end)
      fetch(
        `http://localhost:4000/api/rtc/conversations/${currentConversationId}/end`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        },
      ).catch(() => {});
    }
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
}

// Initially show login form
window.onload = async () => {
  const token = localStorage.getItem('access_token');
  if (token) {
    try {
      const decodedToken = JSON.parse(atob(token.split('.')[1]));
      userId = decodedToken.sub;

      console.log('user id on load:', userId);
    } catch (error) {
      console.error('Error decoding token:', error);
      localStorage.removeItem('access_token');
    }

    showChatView();
    await renderConversations();
    connectSocket();
  } else {
    showAuthView();
  }
};
