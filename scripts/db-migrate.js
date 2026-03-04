#!/usr/bin/env node
/**
 * db-migrate.js — Custom SQL migration runner for Genomatch
 *
 * Tracks executed migrations in a `_migrations` table in the DB.
 * Only processes .sql files from database/migrations/ (in alphabetical order).
 *
 * Usage:
 *   node scripts/db-migrate.js               → run all pending migrations
 *   node scripts/db-migrate.js --status      → show migration status
 *   node scripts/db-migrate.js --undo-last   → revert the last migration (if down file exists)
 *   node scripts/db-migrate.js --reset       → drop _migrations table and re-run all (DEV ONLY)
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'database', 'migrations');
const TRACKING_TABLE = '_migrations';

const sslConfig =
  process.env.DB_SSL === 'true'
    ? { require: true, rejectUnauthorized: false }
    : false;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslConfig,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create the _migrations tracking table if it doesn't exist.
 */
async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Return list of already-executed migration filenames.
 */
async function getExecutedMigrations(client) {
  const result = await client.query(
    `SELECT filename FROM ${TRACKING_TABLE} ORDER BY id`
  );
  return result.rows.map((r) => r.filename);
}

/**
 * Return all .sql files from the migrations directory, sorted alphabetically.
 * Files in subdirectories (like legacy/) are ignored.
 */
function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function runMigrations() {
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const executed = await getExecutedMigrations(client);
    const files = getMigrationFiles();
    const pending = files.filter((f) => !executed.includes(f));

    if (pending.length === 0) {
      console.log('✓ All migrations are up to date.');
      return;
    }

    console.log(`Running ${pending.length} pending migration(s)...\n`);

    for (const filename of pending) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, 'utf8');

      process.stdout.write(`  → ${filename} ... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO ${TRACKING_TABLE} (filename) VALUES ($1)`,
          [filename]
        );
        await client.query('COMMIT');
        console.log('✓');
      } catch (err) {
        await client.query('ROLLBACK');
        console.log('✗ FAILED');
        console.error(`\n  Error in ${filename}:\n  ${err.message}\n`);
        process.exit(1);
      }
    }

    console.log(`\n✓ ${pending.length} migration(s) executed successfully.`);
  } finally {
    client.release();
  }
}

async function showStatus() {
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const executed = await getExecutedMigrations(client);
    const files = getMigrationFiles();

    console.log('\nMigration status:\n');
    console.log('  Status   File');
    console.log('  ──────   ────────────────────────────────────────');

    for (const filename of files) {
      const status = executed.includes(filename) ? '  ✓ done ' : '  ○ pending';
      console.log(`${status}  ${filename}`);
    }

    const pending = files.filter((f) => !executed.includes(f));
    console.log(
      `\n  ${executed.length} executed, ${pending.length} pending.\n`
    );
  } finally {
    client.release();
  }
}

async function undoLast() {
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const executed = await getExecutedMigrations(client);

    if (executed.length === 0) {
      console.log('No migrations to undo.');
      return;
    }

    const last = executed[executed.length - 1];
    // Look for a corresponding _down.sql file
    const downFile = last.replace('.sql', '_down.sql');
    const downPath = path.join(MIGRATIONS_DIR, downFile);

    if (!fs.existsSync(downPath)) {
      console.error(`✗ No down file found for ${last}`);
      console.error(
        `  Create ${downFile} with the rollback SQL to enable undo.`
      );
      process.exit(1);
    }

    const sql = fs.readFileSync(downPath, 'utf8');
    process.stdout.write(`  → Reverting ${last} ... `);

    await client.query('BEGIN');
    await client.query(sql);
    await client.query(`DELETE FROM ${TRACKING_TABLE} WHERE filename = $1`, [
      last,
    ]);
    await client.query('COMMIT');
    console.log('✓');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log('✗ FAILED');
    console.error(`  ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function resetMigrations() {
  if (process.env.NODE_ENV === 'production') {
    console.error('✗ db:migrate:reset is NOT allowed in production.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log('⚠ Resetting all migrations...\n');
    await client.query(`DROP TABLE IF EXISTS ${TRACKING_TABLE}`);
    console.log('  Tracking table dropped.');
    client.release();
    await runMigrations();
  } catch (err) {
    client.release();
    console.error(`Reset failed: ${err.message}`);
    process.exit(1);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

const arg = process.argv[2];

(async () => {
  try {
    if (arg === '--status') {
      await showStatus();
    } else if (arg === '--undo-last') {
      await undoLast();
    } else if (arg === '--reset') {
      await resetMigrations();
    } else {
      await runMigrations();
    }
  } catch (err) {
    console.error('Migration runner error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
