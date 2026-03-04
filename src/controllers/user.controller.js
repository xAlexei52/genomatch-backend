const userService = require('../services/user.service');
const ResponseUtil = require('../utils/response.util');

class UserController {
  async getAllUsers(req, res, next) {
    try {
      // Optionally filter by site_id from query param
      const siteId = req.query.site_id || null;
      const users = await userService.getAllUsers(siteId);
      return ResponseUtil.success(res, users);
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);

      if (!user) {
        return ResponseUtil.notFound(res, 'User not found');
      }

      return ResponseUtil.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /users
   * Body: { site_id, username, full_name, email?, password }
   */
  async createUser(req, res, next) {
    try {
      const { site_id, username, full_name, email, password } = req.body;

      if (!site_id || !username || !full_name || !password) {
        return ResponseUtil.badRequest(
          res,
          'site_id, username, full_name and password are required'
        );
      }

      const user = await userService.createUser({
        site_id,
        username,
        full_name,
        email,
        password,
      });
      return ResponseUtil.success(res, user, 'User created successfully', 201);
    } catch (error) {
      if (error.code === '23505') {
        return ResponseUtil.badRequest(res, 'Username already exists');
      }
      if (error.code === '23503') {
        return ResponseUtil.badRequest(res, 'Invalid site_id');
      }
      next(error);
    }
  }

  /**
   * PUT /users/:id
   * Body: any subset of { username, full_name, email, password, is_active }
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const user = await userService.updateUser(id, req.body);

      if (!user) {
        return ResponseUtil.notFound(res, 'User not found');
      }

      return ResponseUtil.success(res, user, 'User updated successfully');
    } catch (error) {
      if (error.code === '23505') {
        return ResponseUtil.badRequest(res, 'Username already exists');
      }
      if (error.message === 'No fields to update') {
        return ResponseUtil.badRequest(res, 'No fields to update');
      }
      next(error);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await userService.deleteUser(id);

      if (!deleted) {
        return ResponseUtil.notFound(res, 'User not found');
      }

      return ResponseUtil.success(res, null, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /users/:id/permissions
   * Body: { screens: ['dashboard', 'search', 'import', ...] }
   *
   * Replaces the full list of allowed screens for the user.
   * The frontend decides which screens exist — the backend just stores them.
   */
  async updatePermissions(req, res, next) {
    try {
      const { id } = req.params;
      const { screens } = req.body;

      if (!Array.isArray(screens)) {
        return ResponseUtil.badRequest(
          res,
          'screens must be an array of screen keys'
        );
      }

      const user = await userService.getUserById(id);
      if (!user) {
        return ResponseUtil.notFound(res, 'User not found');
      }

      const updatedScreens = await userService.updatePermissions(id, screens);
      return ResponseUtil.success(
        res,
        { userId: id, screens: updatedScreens },
        'Permissions updated'
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
