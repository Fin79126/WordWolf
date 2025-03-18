const express = require('express');
const app = express();
const http = require('http').createServer(app);
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const { users , rooms } = require('./shared/users');
const room = require('./routes/room');
const io = new Server(http);

const sessionMiddleware = session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false
})

const roomRouter = require('./routes/room')(io, sessionMiddleware);
const gameRouter = require('./routes/game')(io, sessionMiddleware);

const gameIo = io.of("/game");
const roomIo = io.of("/room");

app.use(cookieParser());  // クッキーの解析
app.use(express.json());  // JSONパース用ミドルウェア
app.use(sessionMiddleware);  // セッションの設定

app.use('/room', roomRouter);
app.use('/game', gameRouter);

app.use(express.static('public'));
app.use(express.json());  // POSTリクエストのボディを解析するために必要

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// setInterval(() => {
//     console.log('BadRoom');
//     // const tempR = rooms;
//     // rooms.length = 0;
//     rooms.splice(0,rooms.length,...rooms.filter(room => {
//         let gameCount = gameIo.adapter.rooms.get(room.roomId);
//         let roomCount = roomIo.adapter.rooms.get(room.roomId);
        
//         if (!gameCount && !roomCount) {
//             console.log(`Deleting room ${room.roomId}`);
//             // const tempU = users;
//             // users.length = 0;
//             users.splice(0,users.length,...users.filter(u => !room.userIds.includes(u.userId)));
//             return false;
//         }
//         return true;
//     }));
// }, 20000);

http.listen(3000, () => {
    console.log('Server is running on port 3000');
});
