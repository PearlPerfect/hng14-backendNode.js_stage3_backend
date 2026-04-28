require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log('Running migrations...');

  // Users table
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

  // Refresh tokens table (server-side invalidation)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Profiles table (Stage 2 schema + country_name)
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

  // Add missing columns if upgrading from Stage 2
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_name VARCHAR DEFAULT ''`);
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sample_size INTEGER DEFAULT 0`);

  // Indexes
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_gender      ON profiles(gender)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_age_group   ON profiles(age_group)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_country_id  ON profiles(country_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_age         ON profiles(age)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_created_at  ON profiles(created_at)`);

  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });