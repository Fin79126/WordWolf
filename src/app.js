const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const router = require('./routes/room')(io);
app.use('/room', router);


app.use(express.static('public'));
app.use(express.json());  // POSTリクエストのボディを解析するために必要

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});



http.listen(3000, () => {
    console.log('Server is running on port 3000');
});
