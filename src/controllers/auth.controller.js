const authService = require('../services/auth.service');
const ResponseUtil = require('../utils/response.util');

class AuthController {
  async login(req, res, next) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return ResponseUtil.badRequest(
          res,
          'Username and password are required'
        );
      }

      const result = await authService.login(username, password);

      if (!result) {
        return ResponseUtil.unauthorized(res, 'Invalid credentials');
      }

      return ResponseUtil.success(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      return ResponseUtil.success(res, req.user);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
