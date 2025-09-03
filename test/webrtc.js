import io from 'socket.io-client';

const socket = io('http://localhost:4000/ws', { auth: { token: '<JWT>' } });
let localStream;
let peerConnections = {};

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

async function startCall(conversationId, kind = 'VIDEO') {
  setStatus('Getting media...');
  localStream = await navigator.mediaDevices.getUserMedia({
    video: kind === 'VIDEO',
    audio: true,
  });
  document.getElementById('localVideo').srcObject = localStream;
  setStatus('Media ready. Starting call...');
  socket.emit('call:start', { conversationId, kind });
}

socket.on('call:offer', async ({ fromUserId, conversationId, sdp }) => {
  setStatus('Received offer from ' + fromUserId);
  const pc = createPeerConnection(fromUserId, conversationId);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('call:answer', { conversationId, sdp: answer, toUserId: fromUserId });
});

socket.on('call:answer', async ({ fromUserId, sdp }) => {
  setStatus('Received answer from ' + fromUserId);
  const pc = peerConnections[fromUserId];
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on('call:ice', ({ fromUserId, candidate }) => {
  setStatus('Received ICE from ' + fromUserId);
  const pc = peerConnections[fromUserId];
  if (pc && candidate) pc.addIceCandidate(new RTCIceCandidate(candidate));
});

function createPeerConnection(userId, conversationId) {
  const pc = new RTCPeerConnection();
  peerConnections[userId] = pc;
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('call:ice', { conversationId, candidate: event.candidate, toUserId: userId });
    }
  };
  pc.ontrack = (event) => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
  };
  return pc;
}

window.initiateCall = async function() {
  const conversationId = document.getElementById('conversationId').value;
  const userIds = document.getElementById('userIds').value.split(',').map(s => s.trim());
  await startCall(conversationId);
  userIds.forEach(async (userId) => {
    const pc = createPeerConnection(userId, conversationId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('call:offer', { conversationId, sdp: offer, toUserId: userId });
  });
  setStatus('Call started.');
}

window.endCall = function() {
  Object.values(peerConnections).forEach(pc => pc.close());
  peerConnections = {};
  const conversationId = document.getElementById('conversationId').value;
  socket.emit('call:end', { conversationId });
  setStatus('Call ended.');
}