require('dotenv').config();
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const helmet  = require('helmet');
const cookieParser = require('cookie-parser');
const pool    = require('./config/db');
const authRoutes    = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const errorHandler  = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: [process.env.FRONTEND_URL || 'http://localhost:3000', /localhost/], credentials: true }));
app.use(morgan(':method :url :status :response-time ms'));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// ── Health check —
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// DB table creation on first request
let ready = false;
app.use(async (req, res, next) => {
  if (ready) return next();
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (...)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS refresh_tokens (...)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS profiles (...)`);
    ready = true;
    next();
  } catch (err) { next(err); }
});

app.use('/auth', authRoutes);
app.use('/api/profiles', profileRoutes);

app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/login',     (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));

app.use(errorHandler);
module.exports = app;