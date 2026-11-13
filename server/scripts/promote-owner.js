require("dotenv").config();
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const result = await pool.query(
    `UPDATE app_users
     SET role = 'owner', status = 'approved'
     WHERE lower(email) = 'sliman.ibrahim852@gmail.com'
     RETURNING id, email, role, status, created_at, last_login_at`
  );
  console.log(result.rows);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
