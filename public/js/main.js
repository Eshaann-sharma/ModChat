document.getElementById('createRoom').addEventListener('click', async () => {
    try {
        const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const roomCode = document.getElementById('roomCode');
        roomCode.style.display = 'block';
        roomCode.innerHTML = `Room Code: <strong>${roomId}</strong><br>Redirecting...`;
        
        window.location.href = `/room.html?room=${roomId}`;
    } catch (err) {
        console.error('Error:', err);
        alert('Failed to create room');
    }
});

document.getElementById('joinBtn').addEventListener('click', async () => {
    const roomId = document.getElementById('roomInput').value.trim().toUpperCase();
    if (!roomId) {
        alert('Please enter a room code');
        return;
    }
    window.location.href = `/room.html?room=${roomId}`;
});