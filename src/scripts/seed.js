require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const uuidv7  = require('../utils/uuidv7');
const { getAgeGroup } = require('../utils/classify');



const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  console.log('Reading seed data from seed_profiles.json...');
  const filePath = path.join(__dirname, '../../seed_profiles.json');
  const rawData = fs.readFileSync(filePath, 'utf8');
  const { profiles } = JSON.parse(rawData);
  console.log(`Got ${profiles.length} profiles. Seeding...`);

  // Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id                  TEXT PRIMARY KEY,
      name                VARCHAR NOT NULL UNIQUE,
      gender              VARCHAR,
      gender_probability  FLOAT,
      sample_size         INTEGER,
      age                 INTEGER,
      age_group           VARCHAR,
      country_id          VARCHAR(2),
      country_name        VARCHAR,
      country_probability FLOAT,
      created_at          TEXT NOT NULL
    )
  `);

  let inserted = 0;
  let skipped  = 0;

  for (const p of profiles) {
    try {
      await pool.query(
        `INSERT INTO profiles
          (id, name, gender, gender_probability, sample_size, age, age_group,
           country_id, country_name, country_probability, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (name) DO NOTHING`,
        [
          p.id        || uuidv7(),
          p.name,
          p.gender,
          p.gender_probability,
          p.sample_size   || 0,
          p.age,
          p.age_group     || getAgeGroup(p.age),
          p.country_id,
          p.country_name  || '',
          p.country_probability,
          p.created_at    || new Date().toISOString(),
        ]
      );
      inserted++;
    } catch (err) {
      console.error(`Skipped "${p.name}": ${err.message}`);
      skipped++;
    }
  }

  console.log(`Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });

