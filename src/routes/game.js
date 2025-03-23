const express = require("express");
const router = express.Router();
const path = require("node:path");
const fs = require("node:fs");
const { users, rooms } = require("../shared/users"); // Import users array
const room = require("./room");

// function roomUsers(roomId) {
//     const room = rooms.find(r => r.roomId === roomId);
//     return users.filter(user => room.userIds.includes(user.userId));
// }

module.exports = (io, sessionMiddleware) => {
	const gameIo = io.of("/game");
	gameIo.use((socket, next) => {
		sessionMiddleware(socket.request, {}, next);
	});

	// function roomUsers(roomId) {
	//     const room = rooms.find(r => r.roomId === roomId);
	//     return users.filter(user => room.userIds.includes(user.userId));
	// }

	router.get("/", (req, res) => {
		const roomId = req.query.id;
		const userId = req.session.userId;
		const room = rooms.find((r) => r.roomId === roomId);
		const user = users.find((u) => u.userId === userId);

		if (!room) {
			fs.readFile(
				path.join(__dirname, "../../public/room-not-found.html"),
				"utf8",
				(err, data) => {
					if (err) {
						res.status(500).send("Error reading file");
						return;
					}
					res.status(404).send(data);
				},
			);
			return;
		}

		if (!user) {
			fs.readFile(
				path.join(__dirname, "../../public/user-not-found.html"),
				"utf8",
				(err, data) => {
					if (err) {
						res.status(500).send("Error reading file");
						return;
					}
					res.status(404).send(data);
				},
			);
			return;
		}
		fs.readFile(
			path.join(__dirname, "../../public/game.html"),
			"utf8",
			(err, data) => {
				if (err) {
					res.status(500).send("Error reading file");
					return;
				}
				let modifiedHtml = data;
				if (user.isHost) {
					modifiedHtml = data.replace(
						"</body>",
						`
                    <script>
                    const toVote = () => {
                        socket.emit('startVote', '${roomId}');
                    };
                    </script>
                </body>`,
					);
				}
				if (user.role === "human") {
					modifiedHtml = modifiedHtml.replace(
						`<h1 id="topic">お題</h1>`,
						`
                    <h1 id="topic">${room.topics[0]}</h1>`,
					);
				} else {
					modifiedHtml = modifiedHtml.replace(
						`<h1 id="topic">お題</h1>`,
						`
                    <h1 id="topic">${room.topics[1]}</h1>`,
					);
				}
				res.send(modifiedHtml);
			},
		);
	});

	router.get("/result", (req, res) => {
		const roomId = req.query.id;
		const room = rooms.find((r) => r.roomId === roomId);
		const participants = users.filter((user) =>
			room.userIds.includes(user.userId),
		);
		if (!room) {
			fs.readFile(
				path.join(__dirname, "../../public/room-not-found.html"),
				"utf8",
				(err, data) => {
					if (err) {
						res.status(500).send("Error reading file");
						return;
					}
					res.status(404).send(data);
				},
			);
			return;
		}

		fs.readFile(
			path.join(__dirname, "../../public/result.html"),
			"utf8",
			(err, data) => {
				if (err) {
					res.status(500).send("Error reading file");
					return;
				}
				let modifiedHtml = data
					.replace("{{winSide}}", room.winSide === "wolf" ? "狼" : "村人")
					.replace("{{villagerTopic}}", room.topics[0])
					.replace("{{wolfTopic}}", room.topics[1]);

				const participantsHtml = room.userIds
					.map((userId) => {
						const user = participants.find((u) => u.userId === userId);
						return `<p>${user.name}: ${user.role === "wolf" ? "狼" : "村人"}</p>`;
					})
					.join("");
				modifiedHtml = modifiedHtml.replace(
					"{{participants}}",
					participantsHtml,
				);

				res.send(modifiedHtml);
			},
		);
		// rooms.splice(0,rooms.length,...rooms.filter(room => {
		//     users.splice(0,users.length,...users.filter(u => !room.userIds.includes(u.userId)));
		//     return room.roomId !== roomId
		// }));
	});

	gameIo.on("connection", (socket) => {
		socket.on("joinGame", (roomId) => {
			socket.join(roomId);
			const userId = socket.request.session.userId; // セッションからuserIdを取得
			if (userId) {
				socket.join(userId); // ユーザーIDを部屋名として使用
				console.log(userId, " joined room:", roomId);
			} else {
				console.log("No userId in session");
			}
		});

		socket.on("startVote", (roomId) => {
			const room = rooms.find((r) => r.roomId === roomId);
			const userInRoom = users.filter((user) =>
				room.userIds.includes(user.userId),
			);
			const userInRoomX = userInRoom.map((user) => {
				return { id: user.userId, name: user.name };
			});
			gameIo.to(roomId).emit("voteDisplay", JSON.stringify(userInRoomX));
		});

		socket.on("reversalVote", (correct, roomId) => {
			const room = rooms.find((r) => r.roomId === roomId);
			const roomUsers = users.filter((user) =>
				room.userIds.includes(user.userId),
			);
			if (correct) {
				room.winSide = "wolf";
				for (user of roomUsers) {
					gameIo
						.to(user.userId)
						.emit("redirectToResult", user.name, user.isHost);
				}
			} else {
				room.winSide = "human";
				for (user of roomUsers) {
					gameIo
						.to(user.userId)
						.emit("redirectToResult", user.name, user.isHost);
				}
			}
		});
		socket.on("vote", (votedUserId, roomId) => {
			console.log("voteUserId:", votedUserId);
			users.find((u) => u.userId === votedUserId).countVoted++;
			console.log(users);
			const countVote = users.reduce((acc, user) => {
				return acc + user.countVoted;
			}, 0);
			if (countVote === users.length) {
				const room = rooms.find((r) => r.roomId === roomId);
				const roomUsers = users.filter((user) =>
					room.userIds.includes(user.userId),
				);
				const maxVotedCount = roomUsers.reduce((acc, user) => {
					return user.countVoted > acc ? user.countVoted : acc;
				}, 0);
				const maxVotedUsers = roomUsers.filter(
					(user) => user.countVoted === maxVotedCount,
				);
				let maxVotedUser;
				if (maxVotedUsers.length > 1) {
					maxVotedUser =
						maxVotedUsers[Math.floor(Math.random() * maxVotedUsers.length)];
				} else {
					maxVotedUser = maxVotedUsers[0];
				}
				if (maxVotedUser.role === "wolf") {
					fs.readFile(
						path.join(__dirname, "../../public/reversal.html"),
						"utf8",
						(err, data) => {
							if (err) {
								console.error("Error reading HTML file:", err);
								return;
							}
							const html = data.replace("{{name}}", maxVotedUser.name);
							const Host = users.find((u) => u.isHost).userId;
							gameIo.to(roomId).emit("htmlMessage", html);
							gameIo.to(Host).emit("reversal", roomId);
						},
					);
				} else {
					const room = rooms.find((r) => r.roomId === roomId);
					room.winSide = "wolf";
					for (user of roomUsers) {
						gameIo
							.to(user.userId)
							.emit("redirectToResult", user.name, user.isHost);
					}
				}
			} else {
				fs.readFile(
					path.join(__dirname, "../../public/standby.html"),
					"utf8",
					(err, data) => {
						if (err) {
							console.error("Error reading HTML file:", err);
							return;
						}
						const userId = socket.request.session.userId;
						gameIo.to(userId).emit("htmlMessage", data);
					},
				);
			}
		});
	});

	return router;
};
