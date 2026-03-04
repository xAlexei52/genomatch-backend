const pool = require('../utils/db');
const JwtUtil = require('../utils/jwt.util');
const { getUserScreens, formatUser } = require('../services/auth.service');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
      });
    }

    const token = authHeader.substring(7);
    const decoded = JwtUtil.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    const result = await pool.query(
      `SELECT * FROM users WHERE id = $1 AND is_active = true LIMIT 1`,
      [decoded.id]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    const screens = await getUserScreens(user.id);
    req.user = formatUser(user, screens);

    next();
  } catch (_error) {
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

module.exports = authenticate;
