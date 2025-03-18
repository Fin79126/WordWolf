const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const {users , rooms} = require('../shared/users'); // Import users array
const room = require('./room');


// function roomUsers(roomId) {
//     const room = rooms.find(r => r.roomId === roomId);
//     return users.filter(user => room.userIds.includes(user.userId));
// }


module.exports = (io , sessionMiddleware) => {
    const gameIo = io.of("/game");
    gameIo.use((socket, next) => {
        sessionMiddleware(socket.request, {}, next);
    });

    // function roomUsers(roomId) {
    //     const room = rooms.find(r => r.roomId === roomId);
    //     return users.filter(user => room.userIds.includes(user.userId));
    // }

    router.get('/', (req, res) => {
        const roomId = req.query.id;
        const userId = req.session.userId;
        const room = rooms.find(r => r.roomId === roomId);
        const user = users.find(u => u.userId === userId);
        fs.readFile(path.join(__dirname, '../../public/game.html'), 'utf8', (err, data) => {
            if (err) {
                res.status(500).send('Error reading file');
                return;
            }
            let modifiedHtml = data;
            if (user.isHost) {
                modifiedHtml = data.replace('</body>', `
                    <script>
                    const toVote = () => {
                        socket.emit('startVote', '${roomId}');
                    };
                    </script>
                </body>`);
            }
            if (user.role === 'human') {
                modifiedHtml = modifiedHtml.replace(`<h1 id="topic">お題</h1>`, `
                    <h1 id="topic">${room.topics[0]}</h1>`);
            }
            else {
                modifiedHtml = modifiedHtml.replace(`<h1 id="topic">お題</h1>`, `
                    <h1 id="topic">${room.topics[1]}</h1>`);
            }
            res.send(modifiedHtml);
        });
    });

    router.get('/result', (req, res) => {
        const roomId = req.query.id;
        const room = rooms.find(r => r.roomId === roomId);
        if (!room) {
            res.status(404).send('Room not found');
            return;
        }
        fs.readFile(path.join(__dirname, '../../public/result.html'), 'utf8', (err, data) => {
            if (err) {
                res.status(500).send('Error reading file');
                return;
            }
            let modifiedHtml = data.replace('{{winSide}}', room.winSide === 'wolf' ? '狼' : '村人');
            res.send(modifiedHtml);
        });
    });

    gameIo.on("connection", (socket) => {
        socket.on("joinGame", (roomId) => {
            socket.join(roomId);
            const userId = socket.request.session.userId; // セッションからuserIdを取得
            if (userId) {
                socket.join(userId);  // ユーザーIDを部屋名として使用
                console.log(userId , ' joined room:', roomId);
            } else {
                console.log('No userId in session');
            }
        });

        socket.on('startVote', (roomId) => {
            const room = rooms.find(r => r.roomId === roomId);
            const userInRoom = users.filter(user => room.userIds.includes(user.userId));
            const userInRoomX = userInRoom.map(user => {
                return {id: user.userId, name: user.name};
            });
            gameIo.to(roomId).emit("voteDisplay", JSON.stringify(userInRoomX));
        });

        socket.on('reversalVote', (correct,roomId) => {
            if (correct) {
                const room = rooms.find(r => r.roomId === roomId);
                room.winSide = 'wolf';
                gameIo.to(roomId).emit("redirectToResult");
            }
            else {
                const room = rooms.find(r => r.roomId === roomId);
                room.winSide = 'human';
                gameIo.to(roomId).emit("redirectToResult");
            }
        });
        socket.on('vote', (votedUserId,roomId) => {
            console.log('voteUserId:', votedUserId);
            users.find(u => u.userId === votedUserId).countVoted++;
            console.log(users);
            const countVote = users.reduce((acc, user) => {
                return acc + user.countVoted;
            }, 0);
            if (countVote === users.length) {
                const room = rooms.find(r => r.roomId === roomId);
                const roomUsers = users.filter(user => room.userIds.includes(user.userId));
                const maxVotedCount = roomUsers.reduce((acc, user) => {
                    return user.countVoted > acc ? user.countVoted : acc;
                }, 0);
                const maxVotedUsers = roomUsers.filter(user => user.countVoted === maxVotedCount);
                let maxVotedUser;
                if (maxVotedUsers.length > 1) {
                    maxVotedUser = maxVotedUsers[Math.floor(Math.random() * maxVotedUsers.length)];
                } else {
                    maxVotedUser = maxVotedUsers[0];
                }
                if (maxVotedUser.role === 'wolf') {
                    fs.readFile(path.join(__dirname, '../../public/reversal.html'), "utf8", (err, data) => {
                        if (err) {
                            console.error("Error reading HTML file:", err);
                            return;
                        }
                        const Host = users.find(u => u.isHost).userId;
                        gameIo.to(Host).emit("reversal", roomId);
                        gameIo.to(roomId).emit("htmlMessage", data);
                    });
                }
                else {
                    const room = rooms.find(r => r.roomId === roomId);
                    room.winSide = 'wolf';
                    gameIo.to(roomId).emit("redirectToResult");
                }
            } else {
                fs.readFile(path.join(__dirname, '../../public/standby.html'), "utf8", (err, data) => {
                    if (err) {
                        console.error("Error reading HTML file:", err);
                        return;
                    }
                    const userId = socket.request.session.userId;
                    gameIo.to(userId).emit("htmlMessage", data);
                });
            }
        });
    });

    return router;
};
