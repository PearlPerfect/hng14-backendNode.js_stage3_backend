const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: true, 
  },
  max: 5, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 30000, 

  retryDelay: 1000,
  retryAttempts: 3,
});


pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
});

// Optional: Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

module.exports = pool;