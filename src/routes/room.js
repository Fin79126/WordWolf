const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const session = require('express-session');

let users = []; // Server-side storage for user data

router.use(express.json()); // JSONパース用ミドルウェア

router.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

module.exports = (io) => {
    // "/chat" 名前空間を作成
    const roomIo = io.of("/room");
  
    router.post('/join', (req, res) => {
        const { roomId, name, isHost } = req.body;
        const role = isHost === true ? 'Host' : 'Participant';
        // Check if roomId is already taken for Host
        if (role === 'Host' && users.some(u => u.roomId === roomId && u.role === 'Host')) {
            res.status(400).send({msg: 'Room IDはすでに使用されています'});
            return;
        }

        // Check if roomId exists for Participant
        if (role === 'Participant' && !users.some(u => u.roomId === roomId && u.role === 'Host')) {
            res.status(400).send({msg: 'Room IDが見つかりません'});
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
                res.status(404).send({msg: 'ユーザーエラー'});
                return;
            }
        }

        res.status(200).send({ redirectUrl: `/room?id=${roomId}` });
    });

    router.get('/', (req, res) => {
        const { id: roomId } = req.query;
        const userId = req.session.userId;
        const user = users.find(u => u.userId === userId);

        if (!user) {
            res.status(404).send('User not found');
            return;
        }

        fs.readFile(path.join(__dirname, '../../public/room.html'), 'utf8', (err, data) => {
            if (err) {
                res.status(500).send('Error reading file');
                return;
            }

            let modifiedHtml = data.replace('Room ID: ', `Room ID: ${roomId}`)
                                .replace('Name: ', `Name: ${user.name}`)
                                .replace('Role: ', `Role: ${user.role}`);

            // Add start button for host
            if (user.role === 'Host') {
                modifiedHtml = modifiedHtml.replace('</body>', `
                    <button id="startButton">Start Game</button>
                    <script>
                        document.getElementById('startButton').addEventListener('click', function() {
                        socket.emit('startGame', { roomId: '${roomId}' });
                        });
                    </script>
                </body>`);
            }

            res.send(modifiedHtml);
        });
    });

    roomIo.on("connection", (socket) => {
        console.log("User connected to /room namespace");
        socket.on("joinRoom", (roomId) => {
            console.log(`User joined room: ${roomId}`);
            socket.join(roomId);
            // Notify all participants in the room
            roomIo.to(roomId).emit('updateParticipants', users.filter(u => u.roomId === roomId));
        });

        socket.on('startGame', () => {
            const rooms = Array.from(socket.rooms);
            const roomId = rooms.find(room => room !== socket.id);
            console.log('Game started in room:', roomId);
            if (roomId) {
                roomIo.to(roomId).emit('redirectToGame', `/room/game?roomId=${roomId}`);
            }
        });
    });

    return router;
};
