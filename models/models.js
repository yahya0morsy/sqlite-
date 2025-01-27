const { DataTypes } = require('sequelize');
const sequelize = require('../database.js'); // Import your Sequelize instance

// Define the User model
const User = sequelize.define('User', {
  displayName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Define the Message model
const Message = sequelize.define('Message', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  content: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false, // Default to the current time
    defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 2 days from now
  },
});

// Define the Session model
const Session = sequelize.define('Session', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false, // Default to the current time
    defaultValue: () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
  },
});

// Define the Account model
const Account = sequelize.define('Account', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  accountBalance: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0, // Ensure balance is never negative
    },
  },
  grade: {
    type: DataTypes.STRING,
    defaultValue: null, // Default value is null
  },
});

// Export all models
module.exports = { User, Message, Session, Account };