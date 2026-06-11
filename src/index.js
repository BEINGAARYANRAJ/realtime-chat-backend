const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const { createTables } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { initSocket } = require('./socket');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);

app.use(cors({ 
  origin: [process.env.CLIENT_URL, 'http://localhost:3000'],
  credentials: true 
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', messageRoutes);

app.get('/', (req, res) => res.json({ status: 'Server running ✅' }));

const start = async () => {
  await createTables();
  await connectRedis();
  initSocket(server);
  server.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT} ✅`);
    console.log(`Socket.io initialized ✅`);
  });
};

start();