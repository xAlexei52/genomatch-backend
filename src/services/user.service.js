const bcrypt = require('bcryptjs');
const pool = require('../utils/db');
const { getUserScreens, formatUser } = require('./auth.service');

class UserService {
  async getAllUsers(siteId = null) {
    const query = siteId
      ? `SELECT * FROM users WHERE site_id = $1 ORDER BY full_name`
      : `SELECT * FROM users ORDER BY full_name`;
    const params = siteId ? [siteId] : [];
    const result = await pool.query(query, params);
    return result.rows.map((row) => formatUser(row));
  }

  async getUserById(id) {
    const result = await pool.query(
      `SELECT * FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!result.rows[0]) return null;
    const screens = await getUserScreens(id);
    return formatUser(result.rows[0], screens);
  }

  /**
   * Create a new user.
   * Required: site_id, username, full_name, password
   * Optional: email
   */
  async createUser({ site_id, username, full_name, email, password }) {
    if (!site_id || !username || !full_name || !password) {
      throw new Error('site_id, username, full_name and password are required');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (site_id, username, full_name, email, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [site_id, username, full_name, email || null, passwordHash]
    );

    return formatUser(result.rows[0], []);
  }

  /**
   * Update user fields (username, full_name, email, password, is_active).
   * Only provided fields are updated.
   */
  async updateUser(id, { username, full_name, email, password, is_active }) {
    const sets = [];
    const values = [];
    let idx = 1;

    if (username !== undefined) {
      sets.push(`username = $${idx++}`);
      values.push(username);
    }
    if (full_name !== undefined) {
      sets.push(`full_name = $${idx++}`);
      values.push(full_name);
    }
    if (email !== undefined) {
      sets.push(`email = $${idx++}`);
      values.push(email);
    }
    if (is_active !== undefined) {
      sets.push(`is_active = $${idx++}`);
      values.push(is_active);
    }
    if (password !== undefined) {
      const hash = await bcrypt.hash(password, 12);
      sets.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    if (sets.length === 0) throw new Error('No fields to update');

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!result.rows[0]) return null;
    const screens = await getUserScreens(id);
    return formatUser(result.rows[0], screens);
  }

  async deleteUser(id) {
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Replace a user's allowed screens.
   * Accepts an array of screen_key strings.
   * Each screen gets full CRUD access (can_view/create/edit/delete = true).
   */
  async updatePermissions(userId, screens) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete all existing permissions for this user
      await client.query(`DELETE FROM screen_permissions WHERE user_id = $1`, [
        userId,
      ]);

      // Insert new permissions
      for (const screenKey of screens) {
        await client.query(
          `INSERT INTO screen_permissions (user_id, screen_key, can_view, can_create, can_edit, can_delete)
           VALUES ($1, $2, true, true, true, true)`,
          [userId, screenKey]
        );
      }

      await client.query('COMMIT');
      return screens;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new UserService();
