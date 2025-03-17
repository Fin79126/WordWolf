const express = require('express');
const app = express();
const http = require('http').createServer(app);
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const io = new Server(http);

const sessionMiddleware = session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false
})

const roomRouter = require('./routes/room')(io, sessionMiddleware);
const gameRouter = require('./routes/game')(io, sessionMiddleware);



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

http.listen(3000, () => {
    console.log('Server is running on port 3000');
});
