const { pool } = require('../config/db');
const { client: redisClient } = require('../config/redis');

const handleConnection = (io, socket) => {
  console.log(`User connected: ${socket.userId}`);

  // Set user online in Redis
  redisClient.set(`online:${socket.userId}`, '1', { EX: 86400 });

  // Broadcast online status to everyone
  io.emit('user:online', { userId: socket.userId });

  // Join a room
  socket.on('room:join', async ({ roomId }) => {
    socket.join(roomId);
    console.log(`User ${socket.userId} joined room ${roomId}`);

    // Load last 50 messages
    const result = await pool.query(
      `SELECT m.*, u.username, u.avatar 
       FROM messages m 
       JOIN users u ON m.sender_id = u.id 
       WHERE m.room_id = $1 
       ORDER BY m.created_at DESC 
       LIMIT 50`,
      [roomId]
    );

    socket.emit('messages:history', result.rows.reverse());

    // Mark messages as read
    await pool.query(
      `UPDATE messages SET is_read = TRUE 
       WHERE room_id = $1 AND sender_id != $2`,
      [roomId, socket.userId]
    );

    // Notify others that messages were read
    socket.to(roomId).emit('messages:read', {
      roomId,
      userId: socket.userId,
    });
  });

  // Send a message
  socket.on('message:send', async ({ roomId, content }) => {
    try {
      const result = await pool.query(
        `INSERT INTO messages (room_id, sender_id, content) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [roomId, socket.userId, content]
      );

      const message = result.rows[0];

      // Get sender info
      const userResult = await pool.query(
        'SELECT username, avatar FROM users WHERE id = $1',
        [socket.userId]
      );

      const fullMessage = {
        ...message,
        username: userResult.rows[0].username,
        avatar: userResult.rows[0].avatar,
      };

      // Send to everyone in the room
      io.to(roomId).emit('message:new', fullMessage);
    } catch (err) {
      console.error('Message error:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing:start', ({ roomId }) => {
    socket.to(roomId).emit('typing:start', {
      userId: socket.userId,
      username: socket.username,
    });
  });

  socket.on('typing:stop', ({ roomId }) => {
    socket.to(roomId).emit('typing:stop', {
      userId: socket.userId,
    });
  });

  // Leave room
  socket.on('room:leave', ({ roomId }) => {
    socket.leave(roomId);
    console.log(`User ${socket.userId} left room ${roomId}`);
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.userId}`);

    // Remove from online in Redis
    await redisClient.del(`online:${socket.userId}`);

    // Broadcast offline status
    io.emit('user:offline', { userId: socket.userId });
  });
};

module.exports = { handleConnection };