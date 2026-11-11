CREATE TABLE IF NOT EXISTS proxies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'http',
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  url TEXT NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  body TEXT,
  run_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  proxy_id INTEGER REFERENCES proxies(id) ON DELETE SET NULL,
  game_id INTEGER,
  plan_id INTEGER,
  plan_step_id INTEGER,
  batch_id TEXT,
  request_kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_runs (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  ok BOOLEAN,
  status_code INTEGER,
  error TEXT,
  response_preview TEXT,
  response_body TEXT,
  response_headers JSONB,
  request_method TEXT,
  request_url TEXT,
  request_headers JSONB,
  request_body TEXT
);

CREATE INDEX IF NOT EXISTS jobs_due_idx ON jobs (status, run_at);
CREATE INDEX IF NOT EXISTS job_runs_job_id_idx ON job_runs (job_id, started_at DESC);

CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_variables (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_steps (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  variable_id INTEGER NOT NULL REFERENCES game_variables(id) ON DELETE CASCADE,
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  time_value TEXT NOT NULL DEFAULT '',
  run_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings (key, value)
VALUES
  ('timezone', 'local'),
  ('default_run_time', '10:00'),
  ('daily_time_spent', '30000'),
  ('time_spent_noise', '300')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS game_variables_game_id_idx ON game_variables (game_id, sort_order);
CREATE INDEX IF NOT EXISTS plans_game_id_idx ON plans (game_id);
CREATE INDEX IF NOT EXISTS plan_steps_plan_id_idx ON plan_steps (plan_id, sort_order);
