const express = require('express');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all rooms
router.get('/rooms', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.username as creator,
       COUNT(rm.user_id) as member_count
       FROM rooms r
       JOIN users u ON r.created_by = u.id
       LEFT JOIN room_members rm ON r.id = rm.room_id
       GROUP BY r.id, u.username
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a room
router.post('/rooms', authMiddleware, async (req, res) => {
  const { name } = req.body;
  try {
    const existing = await pool.query(
      'SELECT id FROM rooms WHERE name = $1', [name]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Room already exists' });
    }

    const result = await pool.query(
      'INSERT INTO rooms (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, req.user.id]
    );

    // Auto join the creator
    await pool.query(
      'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)',
      [result.rows[0].id, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Join a room
router.post('/rooms/:id/join', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Joined room' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get online users
router.get('/online-users', authMiddleware, async (req, res) => {
  try {
    const { client: redisClient } = require('../config/redis');
    const keys = await redisClient.keys('online:*');
    const onlineUserIds = keys.map(k => parseInt(k.split(':')[1]));
    res.json({ onlineUsers: onlineUserIds });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;