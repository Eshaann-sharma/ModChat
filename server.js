const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms
const rooms = new Map();

// Update the socket connection handler with better error handling
io.on('connection', socket => {
    console.log('New connection:', socket.id);

    // Handle room joining with error handling
    socket.on('join-room', (roomId) => {
        try {
            if (!roomId) {
                throw new Error('Room ID is required');
            }

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
            
            // Emit room joined event with room status
            socket.emit('room-joined', { 
                isInitiator,
                roomId,
                participantCount: room.size
            });

            if (room.size === 2) {
                console.log(`Room ${roomId} is now full, notifying peers`);
                socket.to(roomId).emit('peer-joined', { peerId: socket.id });
            }
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', {
                message: 'Failed to join room',
                details: error.message
            });
        }
    });

    // WebRTC signaling with error handling
    socket.on('offer', (roomId, offer) => {
        try {
            if (!rooms.has(roomId)) {
                throw new Error('Room not found');
            }
            console.log(`Sending offer in room ${roomId}`);
            socket.to(roomId).emit('offer', offer);
        } catch (error) {
            console.error('Error sending offer:', error);
            socket.emit('error', {
                message: 'Failed to send offer',
                details: error.message
            });
        }
    });

    socket.on('answer', (roomId, answer) => {
        try {
            if (!rooms.has(roomId)) {
                throw new Error('Room not found');
            }
            console.log(`Sending answer in room ${roomId}`);
            socket.to(roomId).emit('answer', answer);
        } catch (error) {
            console.error('Error sending answer:', error);
            socket.emit('error', {
                message: 'Failed to send answer',
                details: error.message
            });
        }
    });

    socket.on('ice-candidate', (roomId, candidate) => {
        try {
            if (!rooms.has(roomId)) {
                throw new Error('Room not found');
            }
            console.log(`Sending ICE candidate in room ${roomId}`);
            socket.to(roomId).emit('ice-candidate', candidate);
        } catch (error) {
            console.error('Error sending ICE candidate:', error);
            socket.emit('error', {
                message: 'Failed to send ICE candidate',
                details: error.message
            });
        }
    });

    // Handle disconnection
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

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
const startServer = async (initialPort) => {
    let port = initialPort;
    
    while (port < initialPort + 10) { // Try up to 10 ports
        try {
            await new Promise((resolve, reject) => {
                server.listen(port)
                    .once('listening', () => {
                        console.log(`Server running on port ${port}`);
                        resolve();
                    })
                    .once('error', (err) => {
                        if (err.code === 'EADDRINUSE') {
                            port++;
                            server.close();
                            reject(err);
                        } else {
                            reject(err);
                        }
                    });
            });
            return port; // Successfully started
        } catch (err) {
            if (err.code !== 'EADDRINUSE') {
                throw err; // Throw if it's not a port in use error
            }
        }
    }
    throw new Error('Could not find an available port');
};

startServer(3001).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});