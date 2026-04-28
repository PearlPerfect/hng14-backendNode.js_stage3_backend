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
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', /localhost/],
  credentials: true,
}));
app.use(morgan(':method :url :status :response-time ms'));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// DB table creation on first request
let ready = false;
app.use(async (req, res, next) => {
  if (ready) return next();
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, github_id VARCHAR UNIQUE NOT NULL,
      username VARCHAR, email VARCHAR, avatar_url VARCHAR,
      role VARCHAR DEFAULT 'analyst', is_active BOOLEAN DEFAULT true,
      last_login_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL, expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY, name VARCHAR NOT NULL UNIQUE, gender VARCHAR,
      gender_probability FLOAT, sample_size INTEGER DEFAULT 0, age INTEGER,
      age_group VARCHAR, country_id VARCHAR(2), country_name VARCHAR DEFAULT '',
      country_probability FLOAT, created_at TEXT NOT NULL
    )`);
    ready = true;
    next();
  } catch (err) { next(err); }
});

app.use('/auth', authRoutes);
app.use('/api/profiles', profileRoutes);

// Web portal routes
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/login',     (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));

app.use(errorHandler);
module.exports = app;