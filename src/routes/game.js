const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const {users , rooms} = require('../shared/users'); // Import users array


module.exports = (io , sessionMiddleware) => {
    const gameIo = io.of("/game");
    gameIo.use((socket, next) => {
        sessionMiddleware(socket.request, {}, next);
    });

    router.get('/', (req, res) => {
        const roomId = req.query.id;
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

    gameIo.on("connection", (socket) => {
        socket.on("joinGame", (roomId) => {
            console.log('User joined game:', roomId);
            socket.join(roomId);
            const userId = socket.request.session.userId; // セッションからuserIdを取得
            console.log(`User ${userId} joined room.`);
            if (userId) {
            socket.join(userId);  // ユーザーIDを部屋名として使用
            console.log(`User ${userId} joined room.`);
            } else {
            console.log('No userId in session');
            }
        });

        socket.on('startVote', (roomId) => {
            fs.readFile(path.join(__dirname, '../../public/vote.html'), "utf8", (err, data) => {
                if (err) {
                    console.error("Error reading HTML file:", err);
                    return;
                }
                gameIo.to(roomId).emit("htmlMessage", data);
            });
        });
    });

    return router;
};
