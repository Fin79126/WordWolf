const express = require("express");
const router = express.Router();
const path = require("node:path");
const fs = require("node:fs");
const { users, rooms } = require("../shared/users"); // Import users array
const { GoogleGenerativeAI } = require("@google/generative-ai");
const api_key = process.env.API_KEY; // Access your API key as an environment variable (see "Set up your API key" above)

// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(api_key);

async function gemini() {
	// The Gemini 1.5 models are versatile and work with both text-only and multimodal prompts
	const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

	// const numGemini = 80;
	// const ad = Math.floor(Math.random() * numGemini);
	// console.log(ad);
	// const prompt = `日本語で${ad}才に関連した8文字程度の2つのワードを、マークダウンを使わず次の書式の通りに20個生成してください。例0-りんご-みかん`;

	const prompt =
		"中難易度のワードウルフのお題を20個考えて、マークダウンを使わず次の書式の通りに生成してください。例0-スマートフォン-タブレット";

	const result = await model.generateContent(prompt);
	const response = await result.response;
	const text = response.text();
	console.log(text);
	// Split the generated text into two variables
	const randomNum = Math.floor(Math.random() * 5) + 15;
	const [num, humanTopic, wolfTopic] = text.split("\n")[randomNum].split("-");

	console.log(humanTopic, wolfTopic);

	return [humanTopic, wolfTopic];
}

module.exports = (io, sessionMiddleware) => {
	// "/chat" 名前空間を作成
	const roomIo = io.of("/room");
	roomIo.use((socket, next) => {
		sessionMiddleware(socket.request, {}, next);
	});

	router.post("/rejoin", (req, res) => {
		const { name, isHost } = req.body;
		const roomId = req.body.roomId;
		const roomSome = rooms.some((r) => r.roomId === roomId);
		// Check if roomId is already taken for Host

		if (
			!isHost &&
			roomSome &&
			rooms.find((r) => r.roomId === roomId).roomState === "playing"
		) {
			res.status(400).send({ msg: "まだホストが部屋を立ててません" });
			return;
		}

		// Check if roomId exists for Participant
		if (!isHost && !roomSome) {
			res.status(400).send({ msg: "まだホストが部屋を立ててません" });
			return;
		}

		let userId;
		// Generate a random userId
		if (!req.session.userId) {
			// Save user data to server-side storage
			req.session.userId = Math.random().toString(36).slice(-8);
			userId = req.session.userId;

			users.push({ userId, name, isHost, role: "human", countVoted: 0 });
		} else {
			userId = req.session.userId;
			const user = users.find((u) => u.userId === userId);
			if (user) {
				user.isHost = isHost;
				user.name = name;
				user.role = "human";
				user.countVoted = 0;
			} else {
				users.push({ userId, name, isHost, role: "human", countVoted: 0 });
			}
		}

		if (isHost && roomSome) {
			for (const r of rooms) {
				if (r.roomId === roomId) {
					r.userIds = [req.session.userId];
					r.winSide = "";
					r.setting = {};
					r.roomState = "waiting";
					r.topics = [];
				}
			}
		} else if (isHost) {
			rooms.push({
				roomId: roomId,
				userIds: [req.session.userId],
				winSide: "",
				setting: {},
				roomState: "waiting",
				topics: [],
			});
		} else {
			const room = rooms.find((r) => r.roomId === roomId);
			room.userIds.push(userId);
		}
		res.status(200).send({ redirectUrl: `/room?id=${roomId}` });
	});

	router.post("/join", (req, res) => {
		const { name, isHost } = req.body;
		let roomId = req.body.roomId;
		const roomSome = rooms.some((r) => r.roomId === roomId);
		// Check if roomId is already taken for Host

		if (
			!isHost &&
			roomSome &&
			rooms.find((r) => r.roomId === roomId).roomState === "playing"
		) {
			res.status(400).send({ msg: "ゲーム中の部屋は参加できません" });
			return;
		}

		// Check if roomId exists for Participant
		if (!isHost && !roomSome) {
			res.status(400).send({ msg: "Room IDが見つかりません" });
			return;
		}

		let userId;
		// Generate a random userId
		if (!req.session.userId) {
			// Save user data to server-side storage
			req.session.userId = Math.random().toString(36).slice(-8);
			userId = req.session.userId;

			users.push({ userId, name, isHost, role: "human", countVoted: 0 });
		} else {
			userId = req.session.userId;
			const user = users.find((u) => u.userId === userId);
			if (user) {
				user.isHost = isHost;
				user.name = name;
				user.role = "human";
				user.countVoted = 0;
			} else {
				users.push({ userId, name, isHost, role: "human", countVoted: 0 });
			}
		}

		if (isHost && roomSome) {
			for (const r of rooms) {
				if (r.roomId === roomId) {
					r.userIds = [req.session.userId];
					r.winSide = "";
					r.setting = {};
					r.roomState = "waiting";
					r.topics = [];
				}
			}
		} else if (isHost) {
			roomId = Math.random().toString(36).slice(-8);
			rooms.push({
				roomId,
				userIds: [req.session.userId],
				winSide: "",
				setting: {},
				roomState: "waiting",
				topics: [],
			});
		} else {
			const room = rooms.find((r) => r.roomId === roomId);
			room.userIds.push(userId);
		}

		res.status(200).send({ redirectUrl: `/room?id=${roomId}` });
	});

	router.get("/", (req, res) => {
		const roomId = req.query.id;
		const userId = req.session.userId;
		const user = users.find((u) => u.userId === userId);
		const room = rooms.find((r) => r.roomId === roomId);

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
			path.join(__dirname, "../../public/room.html"),
			"utf8",
			(err, data) => {
				if (err) {
					res.status(500).send("Error reading file");
					return;
				}

				let modifiedHtml = data.replace(
					'<h1 id="roomId" style="cursor: pointer;">',
					`<h1 id="roomId" style="cursor: pointer;">${roomId}`,
				);

				// Add start button for host
				if (user.isHost) {
					modifiedHtml = modifiedHtml.replace(
						"</body>",
						`
                    <button id="startButton">Start Game</button>
                    <script>
                        startButton = document.getElementById('startButton')
                        startButton.addEventListener('click', function() {
                        socket.emit('startGame', '${roomId}');
                        startButton.disabled = true;
                        });
                    </script>
                </body>`,
					);
				}

				console.log(users);
				console.log(rooms);
				res.send(modifiedHtml);
			},
		);
	});

	roomIo.on("connection", (socket) => {
		// console.log("User connected to /room namespace");

		socket.on("joinRoom", (roomId) => {
			socket.join(roomId);
			// Notify all participants in the room
			const Inuser = users.filter((u) =>
				rooms.find((r) => r.roomId === roomId).userIds.includes(u.userId),
			);
			roomIo.to(roomId).emit("updateParticipants", JSON.stringify(Inuser));
		});

		socket.on("startGame", (roomId) => {
			if (roomId) {
				const room = rooms.find((r) => r.roomId === roomId);
				const participants = users.filter((u) =>
					room.userIds.includes(u.userId),
				);
				console.log("Room:", room);
				if (participants.length > 0) {
					const randomIndex = Math.floor(Math.random() * participants.length);
					console.log("Random index:", randomIndex);
					participants.forEach((participant, index) => {
						participant.role = index === randomIndex ? "wolf" : "human";
					});
					console.log("Participants:", participants);
				}
				gemini().then((topics) => {
					console.log("Topics:", topics);
					room.roomState = "playing";
					room.topics = topics;
					roomIo.to(roomId).emit("redirectToGame", `/game?id=${roomId}`);
				});
			}
		});
	});

	return router;
};
