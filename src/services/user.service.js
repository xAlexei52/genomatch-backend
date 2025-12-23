const { User } = require('../models');

class UserService {
  async getAllUsers() {
    return await User.findAll({
      attributes: { exclude: ['password'] },
    });
  }

  async getUserById(id) {
    return await User.findByPk(id, {
      attributes: { exclude: ['password'] },
    });
  }

  async createUser(userData) {
    return await User.create(userData);
  }

  async updateUser(id, userData) {
    const user = await User.findByPk(id);

    if (!user) {
      return null;
    }

    return await user.update(userData);
  }

  async deleteUser(id) {
    const user = await User.findByPk(id);

    if (!user) {
      return false;
    }

    await user.destroy();
    return true;
  }
}

module.exports = new UserService();
