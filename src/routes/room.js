const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');

let users = []; // Server-side storage for user data

router.use(cookieParser());  // クッキーの解析
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
        // Check if roomId is already taken for Host
        if (isHost && users.some(u => u.roomId === roomId && u.isHost === isHost)) {
            res.status(400).send({msg: 'Room IDはすでに使用されています'});
            return;
        }

        // Check if roomId exists for Participant
        if (!isHost && !users.some(u => u.roomId === roomId && u.isHost === isHost)) {
            res.status(400).send({msg: 'Room IDが見つかりません'});
            return;
        }

        // Generate a random userId
        if (!req.session.userId) {
            // Save user data to server-side storage
            req.session.userId = Math.random().toString(36).slice(-8);
            const userId = req.session.userId;
            users.push({ userId, name, roomId, isHost });
        } else {
            const userId = req.session.userId;
            const user = users.find(u => u.userId === userId);
            if (user) {
                user.roomId = roomId;
                user.isHost = isHost;
                user.name = name;
            } else {
                res.status(404).send({msg: 'ユーザーエラー'});
                return;
            }
        }

        res.status(200).send({ redirectUrl: `/room?id=${roomId}` });
    });

    router.get('/', (req, res) => {
        const roomId= req.query.id;
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
                                .replace('Host: ', `Host: ${user.isHost}`);

            // Add start button for host
            if (user.isHost) {
                modifiedHtml = modifiedHtml.replace('</body>', `
                    <button id="startButton">Start Game</button>
                    <script>
                        document.getElementById('startButton').addEventListener('click', function() {
                        socket.emit('startGame', '${roomId}');
                        });
                    </script>
                </body>`);
            }

            res.send(modifiedHtml);
        });
    });
 
    router.get('/game', (req, res) => {
        const roomId= req.query.id;
        fs.readFile(path.join(__dirname, '../../public/game.html'), 'utf8', (err, data) => {
            if (err) {
                res.status(500).send('Error reading file');
                return;
            }

            let modifiedHtml = data.replace('</body>', `
                <script>
                const toVote = () => {
                    socket.emit('startVote', '${roomId}');
                };
                </script>
            </body>`);

            res.send(modifiedHtml);
        });
    });

    roomIo.on("connection", (socket) => {
        // console.log("User connected to /room namespace");

        socket.on("joinRoom", (roomId) => {
            console.log('User joined room:', roomId);
            socket.join(roomId);
            const userId = socket.request.session.userId; // セッションからuserIdを取得
            if (userId) {
            socket.join(userId);  // ユーザーIDを部屋名として使用
            console.log(`User ${userId} joined room.`);
            } else {
            console.log('No userId in session');
            }
            // Notify all participants in the room
            roomIo.to(roomId).emit('updateParticipants', users.filter(u => u.roomId === roomId));
        });

        socket.on('startGame', (roomId) => {
            if (roomId) {
                const participants = users.filter(u => u.roomId === roomId);
                if (participants.length > 0) {
                    const randomIndex = Math.floor(Math.random() * participants.length);
                    participants.forEach((participant, index) => {
                        participant.role = index === randomIndex ? 'wolf' : 'human';
                    });
                }
                roomIo.to(roomId).emit('redirectToGame', `/room/game?id=${roomId}`);
            }
        });

        socket.on('startVote', (roomId) => {
            fs.readFile(path.join(__dirname, '../../public/vote.html'), "utf8", (err, data) => {
                if (err) {
                    console.error("Error reading HTML file:", err);
                    return;
                }
                roomIo.to(roomId).emit("htmlMessage", data);
            });
        });
    });

    return router;
};
