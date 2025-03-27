const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms
const rooms = new Map();

io.on('connection', socket => {
    console.log('New connection:', socket.id);

    socket.on('join-room', (roomId) => {
        try {
            if (!roomId) throw new Error('Room ID is required');

            const room = rooms.get(roomId) || new Set();
            const isInitiator = room.size === 0;

            if (room.size >= 2) {
                socket.emit('error', 'Room is full');
                return;
            }

            room.add(socket.id);
            rooms.set(roomId, room);
            socket.join(roomId);

            console.log(`User ${socket.id} joined room ${roomId}. Users in room: ${room.size}`);

            socket.emit('room-joined', { isInitiator, roomId, participantCount: room.size });

            if (room.size === 2) {
                console.log(`Room ${roomId} is now full, notifying peers`);
                socket.to(roomId).emit('peer-joined', { peerId: socket.id });
            }
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room', details: error.message });
        }
    });

    socket.on('offer', (roomId, offer) => {
        try {
            if (!rooms.has(roomId)) throw new Error('Room not found');
            console.log(`Sending offer in room ${roomId}`);
            socket.to(roomId).emit('offer', offer);
        } catch (error) {
            console.error('Error sending offer:', error);
            socket.emit('error', { message: 'Failed to send offer', details: error.message });
        }
    });

    socket.on('answer', (roomId, answer) => {
        try {
            if (!rooms.has(roomId)) throw new Error('Room not found');
            console.log(`Sending answer in room ${roomId}`);
            socket.to(roomId).emit('answer', answer);
        } catch (error) {
            console.error('Error sending answer:', error);
            socket.emit('error', { message: 'Failed to send answer', details: error.message });
        }
    });

    socket.on('ice-candidate', (roomId, candidate) => {
        try {
            if (!rooms.has(roomId)) throw new Error('Room not found');
            console.log(`Sending ICE candidate in room ${roomId}`);
            socket.to(roomId).emit('ice-candidate', candidate);
        } catch (error) {
            console.error('Error sending ICE candidate:', error);
            socket.emit('error', { message: 'Failed to send ICE candidate', details: error.message });
        }
    });

    socket.on('disconnect', () => {
        try {
            rooms.forEach((users, roomId) => {
                if (users.has(socket.id)) {
                    users.delete(socket.id);
                    if (users.size === 0) {
                        rooms.delete(roomId);
                    } else {
                        socket.to(roomId).emit('peer-disconnected');
                    }
                    console.log(`User ${socket.id} left room ${roomId}`);
                }
            });
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
});

// Start server with explicit IPv4 binding
const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
