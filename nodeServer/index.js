// === Dependencies ===
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');

// === MongoDB Connection ===
const dbURI = 'mongodb+srv://hafiz:TBKWG7PsA3mx2ZZB@test.gwky5vw.mongodb.net/myRealtimeChatApp?retryWrites=true&w=majority&appName=Test';

mongoose.connect(dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// === Dummy Request Handler to Avoid Crash ===
const requestHandler = (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server is running');
};

// === HTTP + Socket.IO Setup ===
const server = http.createServer(requestHandler);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e8
});

const PORT = process.env.PORT || 8000;

// === Data ===
const users = {};
const allowedUsernames = ["Hafizabdullah19", "roman4","344","366","e-5a5","e-5s6","e-5d7","e-5f8","e-5h9","e-6k0","e-6j1","e-6u2","e-6y3","e-6t4","e-6r5","e-6e6","e-6w7","e-6q8","e-6x9","e-7z0"]; 

// === Mongoose Schema & Model ===
const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    type: { type: String, enum: ['text', 'voice', 'image'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// === Socket.IO Event Handling ===
io.on('connection', socket => {
    console.log(`🔌 Connected: ${socket.id}`);

    socket.on('new-user-joined', name => {
        const trimmedName = name?.trim();
        if (trimmedName && allowedUsernames.includes(trimmedName)) {
            users[socket.id] = trimmedName;
            console.log(`👤 User joined: ${trimmedName}`);
            socket.broadcast.emit('user-joined', trimmedName);

            // Send previous messages
            Message.find().sort({ timestamp: 1 }).limit(50)
                .then(messages => socket.emit('load-old-messages', messages))
                .catch(err => console.error('Error loading old messages:', err));
        } else {
            socket.emit('join-error', { message: `Access Denied: "${trimmedName}" not allowed.` });
        }
    });

    socket.on('send-chat-message', async (msg) => {
        const userName = users[socket.id];
        if (userName && msg?.trim()) {
            const trimmed = msg.trim();
            socket.broadcast.emit('chat-message', { message: trimmed, name: userName });
            try {
                await new Message({ sender: userName, type: 'text', content: trimmed }).save();
            } catch (err) {
                console.error('DB Error (text):', err);
            }
        }
    });

    socket.on('send-voice-message', async (data) => {
        const userName = users[socket.id];
        if (userName && data?.audioBase64) {
            socket.broadcast.emit('voice-message', { audioBase64: data.audioBase64, name: userName });
            try {
                await new Message({ sender: userName, type: 'voice', content: data.audioBase64 }).save();
            } catch (err) {
                console.error('DB Error (voice):', err);
            }
        }
    });

    socket.on('send-image-message', async (data) => {
        const userName = users[socket.id];
        if (userName && data?.imageBase64) {
            socket.broadcast.emit('image-message', { imageBase64: data.imageBase64, name: userName });
            try {
                await new Message({ sender: userName, type: 'image', content: data.imageBase64 }).save();
            } catch (err) {
                console.error('DB Error (image):', err);
            }
        }
    });

    socket.on('disconnect', reason => {
        const name = users[socket.id];
        if (name) {
            console.log(`❌ Disconnected: ${name} (${socket.id})`);
            socket.broadcast.emit('user-disconnected', name);
            delete users[socket.id];
        } else {
            console.log(`❌ Unregistered socket disconnected: ${socket.id}`);
        }
    });

    socket.on('error', err => {
        console.error(`⚠️ Socket error (${socket.id}):`, err.message);
    });
});

// === Server Listener ===
server.listen(PORT, () => {
    console.log(`🚀 Server with Socket.IO running on port ${PORT}`);
});
