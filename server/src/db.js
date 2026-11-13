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
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs (user_id, run_at DESC);

    -- Older jobs without an owner go to the first owner/admin account.
    UPDATE jobs
    SET user_id = (
      SELECT id FROM app_users
      WHERE status = 'approved'
      ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, id
      LIMIT 1
    )
    WHERE user_id IS NULL
      AND EXISTS (SELECT 1 FROM app_users WHERE status = 'approved');

    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      display_name TEXT,
      photo_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS app_users_status_idx ON app_users (status);
    CREATE INDEX IF NOT EXISTS app_users_email_idx ON app_users (email);

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

    ALTER TABLE proxies ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS proxies_user_id_idx ON proxies (user_id, created_at DESC);

    ALTER TABLE plans ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS plans_user_id_idx ON plans (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, key)
    );

    UPDATE proxies
    SET user_id = (
      SELECT id FROM app_users
      WHERE status = 'approved'
      ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, id
      LIMIT 1
    )
    WHERE user_id IS NULL
      AND EXISTS (SELECT 1 FROM app_users WHERE status = 'approved');

    UPDATE plans
    SET user_id = (
      SELECT id FROM app_users
      WHERE status = 'approved'
      ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, id
      LIMIT 1
    )
    WHERE user_id IS NULL
      AND EXISTS (SELECT 1 FROM app_users WHERE status = 'approved');
  `);
}

module.exports = { pool, query, migrate };
