const socket = io();
const roomId = new URLSearchParams(window.location.search).get('room');
const vmSocket = io('http://34.46.114.62:3001');
let localStream = null;
let peerConnection = null;

const peerConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },  // Google's STUN
        { urls: "turn:34.46.114.62:3478", username: "webrtcuser", credential: "ENTER YOUR PWD" } // Our GCP TURN server
    ]
};


const RoomState = {
    CREATOR: 'CREATOR',
    JOINER: 'JOINER'
};

let userRole = null;

async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        await localVideo.play();
        document.getElementById('localVideoWrapper').classList.remove('empty');
        
        return localStream;
    } catch (err) {
        console.error('Media device error:', err);
        updateStatus('Camera access failed', 'error');
        throw err;
    }
}

function updateStatus(message, type = 'info') {
    const status = document.getElementById('connectionStatus');
    const statusText = status.querySelector('.status-text');
    statusText.textContent = message;
    
    switch(type) {
        case 'success':
            status.style.background = '#059669';
            break;
        case 'error':
            status.style.background = '#dc2626';
            break;
        case 'warning':
            status.style.background = '#d97706';
            break;
        default:
            status.style.background = '#2563eb';
    }
}

async function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(peerConfig);
    
    // Add local stream tracks
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle incoming stream
    peerConnection.ontrack = ({ streams: [remoteStream] }) => {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo.srcObject !== remoteStream) {
            remoteVideo.srcObject = remoteStream;
            remoteVideo.onloadedmetadata = () => {
                remoteVideo.play()
                    .then(() => {
                        document.getElementById('remoteVideoWrapper').classList.remove('empty');
                        updateStatus('Connected with peer', 'success');
                    })
                    .catch(err => console.error('Remote video failed:', err));
            };
        }
    };

    // ICE candidate handling
    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            socket.emit('ice-candidate', roomId, candidate);
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        switch(peerConnection.connectionState) {
            case 'connected':
                updateStatus('Video chat active', 'success');
                break;
            case 'disconnected':
                updateStatus('Peer disconnected', 'warning');
                break;
            case 'failed':
                updateStatus('Connection failed', 'error');
                break;
        }
    };

    return peerConnection;
}

async function initialize() {
    try {
        if (!roomId) {
            window.location.href = '/';
            return;
        }

        document.getElementById('roomId').textContent = roomId;
        await startLocalStream();

        // Socket event handlers
        socket.on('room-joined', async ({ isInitiator }) => {
            userRole = isInitiator ? RoomState.CREATOR : RoomState.JOINER;
            updateStatus(isInitiator ? 'Waiting for peer to join...' : 'Joining room...', 'info');
            
            if (!isInitiator) {
                await setupPeerConnection();
            }
        });

        socket.on('peer-joined', async () => {
            updateStatus('Peer joined, connecting...', 'info');
            if (userRole === RoomState.CREATOR) {
                await setupPeerConnection();
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                socket.emit('offer', roomId, offer);
            }
        });

        socket.on('offer', async (offer) => {
            if (userRole === RoomState.JOINER) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.emit('answer', roomId, answer);
            }
        });

        socket.on('answer', async (answer) => {
            if (userRole === RoomState.CREATOR) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            }
        });

        socket.on('ice-candidate', async (candidate) => {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('Error adding ICE candidate:', e);
            }
        });

        socket.on('peer-disconnected', () => {
            updateStatus('Peer disconnected', 'warning');
            const remoteVideo = document.getElementById('remoteVideo');
            document.getElementById('remoteVideoWrapper').classList.add('empty');
            if (remoteVideo.srcObject) {
                remoteVideo.srcObject.getTracks().forEach(track => track.stop());
                remoteVideo.srcObject = null;
            }
        });

        // Join room
        socket.emit('join-room', roomId);

    } catch (error) {
        console.error('Initialization error:', error);
        updateStatus('Failed to initialize: ' + error.message, 'error');
    }
}

function captureFrame(videoElement) {
    if (!videoElement || videoElement.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg');  // Convert to Base64
}


// Send Frames to VM for Analysis
function sendFramesToVM() {
    if (localVideo.readyState === 4) {
        const localFrame = captureFrame(localVideo);
        if (localFrame) {
            vmSocket.emit('frame', { roomId, type: 'local', data: localFrame });
        }
    }

    document.querySelectorAll('#remoteVideo').forEach(remoteVideo => {
        if (remoteVideo.readyState === 4) {
            const remoteFrame = captureFrame(remoteVideo);
            if (remoteFrame) {
                vmSocket.emit('frame', { roomId, type: 'remote', data: remoteFrame });
            }
        }
    });
}
// Send frames every 500ms
setInterval(sendFramesToVM, 500);



// Add to your room.js file
socket.on('error', (error) => {
    console.error('Socket error:', error);
});

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Event Listeners
document.getElementById('toggleVideo').onclick = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    document.getElementById('toggleVideo').textContent = 
        videoTrack.enabled ? 'Disable Video' : 'Enable Video';
};

document.getElementById('toggleAudio').onclick = () => {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    document.getElementById('toggleAudio').textContent = 
        audioTrack.enabled ? 'Mute Audio' : 'Unmute Audio';
};

document.getElementById('leaveRoom').onclick = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
    }
    socket.disconnect();
    window.location.href = '/';
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initialize);