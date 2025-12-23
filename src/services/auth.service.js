const { User } = require('../models');
const JwtUtil = require('../utils/jwt.util');

class AuthService {
  async login(email, password) {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return null;
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    const token = JwtUtil.generateToken({
      id: user.id,
      email: user.email,
    });

    return {
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
      },
    };
  }
}

module.exports = new AuthService();
