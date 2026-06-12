const express = require('express');
const http = require('http');
require('dotenv').config();

const { createTables } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { initSocket } = require('./socket');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);

// CORS - handle everything manually
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', messageRoutes);

app.get('/', (req, res) => res.json({ status: 'Server running ✅' }));

const start = async () => {
  await createTables();
  await connectRedis();
  initSocket(server);
  server.listen(process.env.PORT || 10000, '0.0.0.0', () => {
    console.log(`Server running on port ${process.env.PORT || 10000} ✅`);
    console.log(`Socket.io initialized ✅`);
  });
};

start();