const bcrypt = require('bcryptjs');
const pool = require('../utils/db');
const JwtUtil = require('../utils/jwt.util');

/**
 * Fetch the screen keys a user has access to.
 * Returns an array of screen_key strings where can_view = true.
 */
async function getUserScreens(userId) {
  const result = await pool.query(
    `SELECT screen_key FROM screen_permissions WHERE user_id = $1 AND can_view = true ORDER BY screen_key`,
    [userId]
  );
  return result.rows.map((r) => r.screen_key);
}

/**
 * Format a DB user row into the public user object (no password_hash).
 */
function formatUser(row, screens = []) {
  return {
    id: row.id,
    siteId: row.site_id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    isActive: row.is_active,
    screens,
    createdAt: row.created_at,
  };
}

class AuthService {
  /**
   * Login with email + password.
   * Returns { token, user } or null if invalid.
   */
  async login(email, password) {
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1 AND is_active = true LIMIT 1`,
      [email]
    );
    const user = result.rows[0];

    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return null;

    const screens = await getUserScreens(user.id);

    const token = JwtUtil.generateToken({
      id: user.id,
      siteId: user.site_id,
    });

    return {
      token,
      user: formatUser(user, screens),
    };
  }
}

module.exports = new AuthService();
module.exports.getUserScreens = getUserScreens;
module.exports.formatUser = formatUser;
