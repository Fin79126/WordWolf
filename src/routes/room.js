const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const session = require('express-session');

let users = []; // Server-side storage for user data

router.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

module.exports = (io) => {
    // "/chat" 名前空間を作成
    const roomIo = io.of("/room");
  
    router.get('/join', (req, res) => {
        const { roomId, name, isHost } = req.query;
        const role = isHost === "true" ? 'Host' : 'Participant';

        // Check if roomId is already taken for Host
        if (role === 'Host' && users.some(u => u.roomId === roomId && u.role === 'Host')) {
            res.send(`
                <script>
                    alert('Room ID is already taken by another Host');
                    window.location.href = '/';
                </script>
            `);
            return;
        }

        // Check if roomId exists for Participant
        if (role === 'Participant' && !users.some(u => u.roomId === roomId && u.role === 'Host')) {
            res.send(`
                <script>
                    alert('Room ID does not exist');
                    window.location.href = '/';
                </script>
            `);
            return;
        }

        // Generate a random userId
        if (!req.session.userId) {
            // Save user data to server-side storage
            req.session.userId = Math.random().toString(36).slice(-8);
            const userId = req.session.userId;
            users.push({ userId, name, roomId, role });
        } else {
            const userId = req.session.userId;
            const user = users.find(u => u.userId === userId);
            if (user) {
                user.roomId = roomId;
                user.role = role;
                user.name = name;
            } else {
                res.status(404).send('User not found');
                return;
            }
        }

        res.redirect(`/room/standby?id=${roomId}`);
    });

    router.get('/standby', (req, res) => {
        const { id: roomId } = req.query;
        const userId = req.session.userId;
        const user = users.find(u => u.userId === userId);

        if (!user) {
            res.status(404).send('User not found');
            return;
        }

        fs.readFile(path.join(__dirname, '../../public/standby.html'), 'utf8', (err, data) => {
            if (err) {
                res.status(500).send('Error reading file');
                return;
            }

            let modifiedHtml = data.replace('Room ID: ', `Room ID: ${roomId}`)
                                .replace('Name: ', `Name: ${user.name}`)
                                .replace('Role: ', `Role: ${user.role}`);

            res.send(modifiedHtml);
        });
    });

    // // Socket.io connection
    // io.on('connection', (socket) => {
    //     console.log('A user connected');
    //     socket.on('joinRoom', (roomId) => {
    //         console.log(`User joined room: ${roomId}`);
    //         socket.join(roomId);
    //     });
    // });



    roomIo.on("connection", (socket) => {
        socket.on("joinRoom", (roomId) => {
            console.log(`User joined room: ${roomId}`);
            socket.join(roomId);
            // Notify all participants in the room
            roomIo.to(roomId).emit('updateParticipants', users.filter(u => u.roomId === roomId));
        });
    });

    return router;
};
