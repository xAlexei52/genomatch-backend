const JwtUtil = require('../utils/jwt.util');
const { User } = require('../models');

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

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'User account is inactive',
      });
    }

    req.user = user;
    next();
  } catch (_error) {
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

module.exports = authenticate;
