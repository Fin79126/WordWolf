const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const {users , rooms} = require('../shared/users'); // Import users array


module.exports = (io , sessionMiddleware) => {
    // "/chat" 名前空間を作成
    const roomIo = io.of("/room");
    roomIo.use((socket, next) => {
        sessionMiddleware(socket.request, {}, next);
    });
  
    router.post('/join', (req, res) => {
        const { roomId, name, isHost } = req.body;
        // Check if roomId is already taken for Host
        if (isHost && rooms.some(r => r.roomId === roomId)) {
            res.status(400).send({msg: 'Room IDはすでに使用されています'});
            return;
        }

        // Check if roomId exists for Participant
        if (!isHost && !rooms.some(r => r.roomId === roomId)) {
            res.status(400).send({msg: 'Room IDが見つかりません'});
            return;
        }

        // Generate a random userId
        if (!req.session.userId) {
            // Save user data to server-side storage
            req.session.userId = Math.random().toString(36).slice(-8);
            const userId = req.session.userId;

            users.push({ userId, name, isHost , role:'human' , isVoted:false});
        } else {
            const userId = req.session.userId;
            const user = users.find(u => u.userId === userId);
            if (user) {
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
        const room = rooms.find(r => r.roomId === roomId);

        if (room) {
            if (!room.userIds.includes(userId)) {
                room.userIds.push(userId);
            }
        } else {
            rooms.push({ roomId , userIds: [userId] });
        }


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

    roomIo.on("connection", (socket) => {
        // console.log("User connected to /room namespace");

        socket.on("joinRoom", (roomId) => {
            console.log('User joined game:', roomId);
            socket.join(roomId);
            // Notify all participants in the room
            const Inuser = users.filter(u => rooms.find(r => r.roomId === roomId).userIds.includes(u.userId));
            roomIo.to(roomId).emit('updateParticipants', JSON.stringify(Inuser));
        });

        socket.on('startGame', (roomId) => {
            if (roomId) {
                const room = rooms.find(r => r.roomId === roomId);
                const participants = room.userIds;
                console.log('Participants:', participants);
                console.log('Room:', room);
                if (participants.length > 0) {
                    const randomIndex = Math.floor(Math.random() * participants.length);
                    participants.forEach((participant, index) => {
                        participant.role = index === randomIndex ? 'wolf' : 'human';
                    });
                }
                roomIo.to(roomId).emit('redirectToGame', `/game?id=${roomId}`);
            }
        });
    });

    return router;
};
