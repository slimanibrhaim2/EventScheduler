const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  await pool.query(`
    ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS response_body TEXT;
    ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS response_headers JSONB;
    ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS request_method TEXT;
    ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS request_url TEXT;
    ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS request_headers JSONB;
    ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS request_body TEXT;

    ALTER TABLE plan_steps ADD COLUMN IF NOT EXISTS delay_days INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE plan_steps ADD COLUMN IF NOT EXISTS delay_hours INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE plan_steps ADD COLUMN IF NOT EXISTS delay_minutes INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE plan_steps ADD COLUMN IF NOT EXISTS time_value TEXT NOT NULL DEFAULT '';
    ALTER TABLE plan_steps ALTER COLUMN run_at DROP NOT NULL;

    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS game_id INTEGER;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS plan_id INTEGER;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS plan_step_id INTEGER;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS batch_id TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS request_kind TEXT;

    INSERT INTO settings (key, value)
    VALUES
      ('daily_time_spent', '30000'),
      ('time_spent_noise', '300'),
      ('fleet_host', 'residential-v2.fleetproxy.io'),
      ('fleet_port', '5000'),
      ('fleet_user', ''),
      ('fleet_pass', ''),
      ('fleet_protocol', 'http')
    ON CONFLICT (key) DO NOTHING;
  `);
}

module.exports = { pool, query, migrate };
