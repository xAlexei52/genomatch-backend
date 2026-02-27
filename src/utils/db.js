const { Pool } = require('pg');
const config = require('../../config/env');

const sslConfig =
  process.env.DB_SSL === 'true'
    ? { require: true, rejectUnauthorized: false }
    : false;

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  ssl: sslConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
