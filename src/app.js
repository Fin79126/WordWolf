const express = require("express");
const app = express();
const http = require("node:http").createServer(app);
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const { users, rooms } = require("./shared/users");
const room = require("./routes/room");
const io = new Server(http);

const sessionMiddleware = session({
	secret: "your_secret_key",
	resave: false,
	saveUninitialized: false,
});

const roomRouter = require("./routes/room")(io, sessionMiddleware);
const gameRouter = require("./routes/game")(io, sessionMiddleware);

const gameIo = io.of("/game");
const roomIo = io.of("/room");

app.use(cookieParser()); // クッキーの解析
app.use(express.json()); // JSONパース用ミドルウェア
app.use(sessionMiddleware); // セッションの設定

app.use("/room", roomRouter);
app.use("/game", gameRouter);

app.use(express.static("public"));
app.use(express.json()); // POSTリクエストのボディを解析するために必要

app.get("/", (req, res) => {
	res.sendFile(`${__dirname}/public/index.html`);
});

setInterval(() => {
	console.log("BadRoom");
	// const tempR = rooms;
	// rooms.length = 0;
	rooms.splice(
		0,
		rooms.length,
		...rooms.filter((room) => {
			const gameCount = gameIo.adapter.rooms.get(room.roomId);
			const roomCount = roomIo.adapter.rooms.get(room.roomId);

			if (!gameCount && !roomCount) {
				console.log(`Deleting room ${room.roomId}`);
				// const tempU = users;
				// users.length = 0;
				users.splice(
					0,
					users.length,
					...users.filter((u) => !room.userIds.includes(u.userId)),
				);
				return false;
			}
			return true;
		}),
	);
}, 3600000);

const port = PORT || 8080;
http.listen(port, () => {
	console.log("Server is running on port 3000");
});
