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
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

// Updated CORS configuration - Allow all origins
app.use(cors({ 
  origin: true,  // This allows any origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-API-Version', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(morgan(':method :url :status :response-time ms'));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// ── Health check ──
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        github_id     VARCHAR UNIQUE NOT NULL,
        username      VARCHAR,
        email         VARCHAR,
        avatar_url    VARCHAR,
        role          VARCHAR DEFAULT 'analyst',
        is_active     BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        created_at    TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         TEXT PRIMARY KEY,
        user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id                  TEXT PRIMARY KEY,
        name                VARCHAR NOT NULL UNIQUE,
        gender              VARCHAR,
        gender_probability  FLOAT,
        sample_size         INTEGER DEFAULT 0,
        age                 INTEGER,
        age_group           VARCHAR,
        country_id          VARCHAR(2),
        country_name        VARCHAR DEFAULT '',
        country_probability FLOAT,
        created_at          TEXT NOT NULL
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gender     ON profiles(gender)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_age_group  ON profiles(age_group)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_country_id ON profiles(country_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_age        ON profiles(age)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_created_at ON profiles(created_at)`);

    ready = true;
    next();
  } catch (err) {
    next(err);
  }
});

// Add a middleware to log CORS headers for debugging
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

app.use('/auth', authRoutes);
app.use('/api/profiles', profileRoutes);

app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/login',     (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));

app.use(errorHandler);
module.exports = app;
