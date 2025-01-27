const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, Session, Account, Message } = require('../models/models.js'); // Import Sequelize models
const Master_key = 'moataz220022'; // Replace with your actual master key
const sequelize = require('../database.js');
const { Sequelize, Op } = require('sequelize');
// Start the background task to delete expired sessions
setInterval(async () => {
  try {
    const now = new Date();
    await Session.destroy({
      where: {
        expiresAt: {
          [Op.lt]: now, // Delete sessions where expiresAt is less than the current time
        },
      },
    });
    console.log('Expired sessions deleted');
  } catch (error) {
    console.error('Error deleting expired sessions:', error);
  }
}, 60 * 60 * 1000); // Run every hour
sequelize.sync({ alter: true }) // Update tables without dropping them
  .then(() => {
    console.log('Database & tables synced!');
  })
  .catch((err) => {
    console.error('Error syncing database:', err);
  });
// Middleware for input validation
const validateRequest = (req, res, next) => {
  if (!req.body) {
    return res.status(400).send({ error: 'Invalid request body' });
  }
  next();
};

// GET home page
router.get('/', (req, res) => {
  res.render('index', { title: 'Express' });
});

// Create a new user
router.post('/users', validateRequest, async (req, res) => {
  try {
    const { displayName, username, password, phoneNumber } = req.body;

    // Check if all required fields are provided
    if (!displayName || !username || !password || !phoneNumber) {
      return res.status(400).send({ error: 'All fields are required: displayName, username, password, phoneNumber' });
    }

    // Trim leading and trailing spaces from the username
    const trimmedUsername = username.trim();

    // Check if the trimmed username contains any spaces in the middle
    if (trimmedUsername.includes(' ')) {
      return res.status(400).send({ error: 'Username cannot contain spaces' });
    }

    // Validate that the username contains only English letters, numbers, underscores, or hyphens
    if (!/^[A-Za-z0-9_-]+$/.test(trimmedUsername)) {
      return res.status(400).send({ error: 'Username can only contain English letters, numbers, underscores (_), or hyphens (-)' });
    }

    // Validate displayName length (must be at least 3 characters)
    if (displayName.length < 3) {
      return res.status(400).send({ error: 'Display name must be at least 3 characters' });
    }

    // Validate username length (must be at least 4 characters)
    if (trimmedUsername.length < 4) {
      return res.status(400).send({ error: 'Username must be at least 4 characters' });
    }

    // Validate password length (must be at least 5 characters)
    if (password.length < 5) {
      return res.status(400).send({ error: 'Password must be at least 5 characters' });
    }

    // Validate phoneNumber to ensure it contains only numbers
    if (!/^\d+$/.test(phoneNumber)) {
      return res.status(400).send({ error: 'Phone number must contain only numbers' });
    }

    // Check if the username already exists
    const existingUserByUsername = await User.findOne({ where: { username: trimmedUsername } });
    if (existingUserByUsername) {
      return res.status(400).send({ error: 'Username already exists' });
    }

    // Check if the phone number already exists
    const existingUserByPhoneNumber = await User.findOne({ where: { phoneNumber } });
    if (existingUserByPhoneNumber) {
      return res.status(400).send({ error: 'Phone number already exists' });
    }

    // Hash the password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create and save the new user
    const user = await User.create({ displayName, username: trimmedUsername, password: hashedPassword, phoneNumber });

    // Create and save the associated account
    await Account.create({ username: trimmedUsername, phoneNumber, accountBalance: 0 });

    // Return the created user (excluding the password for security)
    const userResponse = { ...user.toJSON() };
    delete userResponse.password; // Remove the password from the response
    res.status(201).send({ user: userResponse });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({ limit: 100 }); // Add pagination or limits
    res.send(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// User login
router.post('/login', validateRequest, async (req, res) => {
  try {
    const { username, phoneNumber, password } = req.body;

    // Check if at least one of username or phoneNumber is provided
    if (!username && !phoneNumber) {
      return res.status(400).send({ error: 'Username or phone number is required' });
    }

    // Trim the username if provided
    const trimmedUsername = username ? username.trim() : null;

    // Find the user by username or phone number
    const user = await User.findOne({
      where: {
        [Op.or]: [
          trimmedUsername ? { username: trimmedUsername } : null, // Search by username if provided
          phoneNumber ? { phoneNumber } : null, // Search by phoneNumber if provided
        ].filter(Boolean), // Remove null values from the array
      },
    });

    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    // Validate the password
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send({ error: 'Invalid password' });
    }

    // Find or create a session for the user
    let session = await Session.findOne({ where: { username: user.username } });

    if (!session) {
      const sessionKey = Math.random().toString(36).substring(2, 15); // Generate random session key
      session = await Session.create({ username: user.username, key: sessionKey });
    }

    // Return the session key
    res.send({ key: session.key });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});
// Update user balance
router.post('/users/update-balance', validateRequest, async (req, res) => {
  try {
    const { masterKey, username, phoneNumber, amount, action } = req.body;

    // Validate the master key
    if (masterKey !== Master_key) {
      return res.status(401).send({ error: 'Unauthorized: Invalid master key' });
    }

    // Trim the username if provided
    const trimmedUsername = username ? username.trim() : null;

    // Find the account by username or phone number
    const account = await Account.findOne({
      where: {
        [Sequelize.Op.or]: [{ username: trimmedUsername }, { phoneNumber }],
      },
    });

    if (!account) {
      return res.status(404).send({ error: 'Account not found' });
    }

    // Store the old balance for the message
    const oldBalance = account.accountBalance;

    // Update the balance based on the action
    if (action === 'add') {
      account.accountBalance += amount;
    } else if (action === 'subtract') {
      if (account.accountBalance < amount) {
        return res.status(400).send({ error: 'Insufficient balance' });
      }
      account.accountBalance -= amount;
    } else {
      return res.status(400).send({ error: 'Invalid action' });
    }

    // Save the updated account balance
    await account.save();

    // Create a message for the user
    await Message.create({
      username: account.username,
      content: `Your balance was updated from ${oldBalance} to ${account.accountBalance} by moataz.`,
      date: new Date(),
      time: new Date().toLocaleTimeString(),
    });

    // Return success response
    res.send({ accountBalance: account.accountBalance });
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Fetch account balance and user grade
router.post('/users/balance', validateRequest, async (req, res) => {
  try {
    const { key } = req.body;

    // Validate the session key
    const session = await Session.findOne({ where: { key } });
    if (!session) {
      return res.status(401).send({ error: 'Invalid session key' });
    }

    // Fetch the account (including balance and grade)
    const account = await Account.findOne({ where: { username: session.username } });
    if (!account) {
      return res.status(404).send({ error: 'Account not found' });
    }

    // Return both balance and grade
    res.send({
      accountBalance: account.accountBalance,
      grade: account.grade || 'No grade assigned', // Default value if grade is not set
    });
  } catch (error) {
    console.error('Error fetching balance and grade:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Transfer balance between users
router.post('/users/transfer-balance', validateRequest, async (req, res) => {
  try {
    const { senderKey, recipientUsername, amount } = req.body;

    // Validate that the amount is a positive integer
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).send({ error: 'Amount must be a positive integer' });
    }

    // Validate sender session
    const senderSession = await Session.findOne({ where: { key: senderKey } });
    if (!senderSession) {
      return res.status(401).send({ error: 'Invalid session key' });
    }

    // Validate sender account
    const senderAccount = await Account.findOne({ where: { username: senderSession.username } });
    if (!senderAccount) {
      return res.status(404).send({ error: 'Sender account not found' });
    }

    // Check if sender has sufficient balance
    if (senderAccount.accountBalance < amount) {
      return res.status(400).send({ error: 'Insufficient balance' });
    }

    // Trim the recipient username
    const trimmedRecipientUsername = recipientUsername.trim();

    // Find recipient account by username or phone number
    let recipientAccount = await Account.findOne({ where: { username: trimmedRecipientUsername } });
    const recipientAccount2 = await Account.findOne({ where: { phoneNumber: trimmedRecipientUsername } });

    // If recipient account is not found by username, check by phone number
    if (!recipientAccount) {
      if (!recipientAccount2) {
        return res.status(404).send({ error: 'Recipient account not found' });
      }
    }

    // Use the recipient account found by phone number if username lookup fails
    if (recipientAccount2) {
      recipientAccount = recipientAccount2;
    }

    // Check if sender is trying to transfer to themselves (via username or phone number)
    if (
      senderSession.username === recipientAccount.username || // Check username
      senderAccount.phoneNumber === recipientAccount.phoneNumber // Check phone number
    ) {
      return res.status(400).send({ error: 'You cannot transfer money to yourself' });
    }

    // Perform the balance transfer
    senderAccount.accountBalance -= amount;
    recipientAccount.accountBalance += amount;

    // Save the updated account balances
    await senderAccount.save();
    await recipientAccount.save();

    // Create a message for the sender
    await Message.create({
      username: senderSession.username,
      content: `You sent ${amount} to ${recipientAccount.username}.`,
      date: new Date(),
      time: new Date().toLocaleTimeString(),
    });

    // Create a message for the recipient
    await Message.create({
      username: recipientAccount.username,
      content: `You received ${amount} from ${senderSession.username}.`,
      date: new Date(),
      time: new Date().toLocaleTimeString(),
    });

    // Return success response
    res.send({
      message: 'Transfer successful',
      senderBalance: senderAccount.accountBalance,
      recipientBalance: recipientAccount.accountBalance,
    });
  } catch (error) {
    console.error('Error transferring balance:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Update user grade (requires master key)
router.post('/users/update-grade', validateRequest, async (req, res) => {
  try {
    const { masterKey, username, phoneNumber, grade } = req.body;

    // Validate the master key
    if (masterKey !== Master_key) {
      return res.status(401).send({ error: 'Unauthorized: Invalid master key' });
    }

    // Trim the username if provided
    const trimmedUsername = username ? username.trim() : null;

    // Find the account by username or phone number
    const account = await Account.findOne({
      where: {
        [Sequelize.Op.or]: [{ username: trimmedUsername }, { phoneNumber }],
      },
    });

    if (!account) {
      return res.status(404).send({ error: 'Account not found' });
    }

    // Store the old grade for the message
    const oldGrade = account.grade || 'No grade assigned';

    // Update the grade
    account.grade = grade;
    await account.save();

    // Create a message for the user
    await Message.create({
      username: account.username,
      content: `Your grade was updated from ${oldGrade} to ${grade} by moataz.`,
      date: new Date(),
      time: new Date().toLocaleTimeString(),
    });

    // Return success response
    res.send({ message: 'Grade updated successfully', account });
  } catch (error) {
    console.error('Error updating grade:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// View user balance (requires master key)
router.post('/users/view-balance', async (req, res) => {
  try {
    const { masterKey, username, phoneNumber } = req.body;

    // Validate master key
    if (masterKey !== Master_key) {
      return res.status(401).json({ error: 'Unauthorized: Invalid master key' });
    }

    // Trim the username if provided
    const trimmedUsername = username ? username.trim() : null;

    // Find account by username or phone number
    const account = await Account.findOne({
      where: {
        [Sequelize.Op.or]: [{ username: trimmedUsername }, { phoneNumber }],
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Return account balance and grade
    res.json({
      message: 'Account balance retrieved successfully',
      accountBalance: account.accountBalance,
      grade: account.grade || 'No grade assigned',
    });
  } catch (error) {
    console.error('Error fetching account balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user password
router.post('/users/update-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;

    // Trim the username
    const trimmedUsername = username.trim();

    // Find the user by username
    const user = await User.findOne({ where: { username: trimmedUsername } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate the current password
    const isPasswordValid = bcrypt.compareSync(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    // Hash the new password and update the user's password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin update user password
router.post('/users/admin/update-password', async (req, res) => {
  try {
    const { masterKey, username, newPassword } = req.body;

    // Validate the master key
    if (masterKey !== Master_key) {
      return res.status(401).json({ error: 'Unauthorized: Invalid master key' });
    }

    // Trim the username
    const trimmedUsername = username.trim();

    // Find the user by username
    const user = await User.findOne({ where: { username: trimmedUsername } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash the new password and update the user's password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user data using session key
router.post('/user-data', async (req, res) => {
  const { sessionKey } = req.body;

  if (!sessionKey) {
    return res.status(400).json({ error: 'Session key is required.' });
  }

  try {
    // Find the session by key
    const session = await Session.findOne({ where: { key: sessionKey } });

    if (!session) {
      return res.status(404).json({ error: 'Invalid session key.' });
    }

    // Find the user by username from the session
    const user = await User.findOne({ where: { username: session.username } });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Return user data (excluding sensitive information like password)
    res.json({
      displayName: user.displayName,
      username: user.username,
      phoneNumber: user.phoneNumber,
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Fetch user messages
router.post('/users/messages', validateRequest, async (req, res) => {
  try {
    const { key } = req.body; // Session key to identify the user

    // Validate the session key
    const session = await Session.findOne({ where: { key } });
    if (!session) {
      return res.status(401).send({ error: 'Invalid session key' });
    }

    // Fetch the latest 10 messages for the user
    const messages = await Message.findAll({
      where: { username: session.username },
      order: [['date', 'DESC'], ['time', 'DESC']], // Sort by date and time in descending order
      limit: 10, // Limit to 10 messages
    });

    // Return the messages
    res.send({ messages });
  } catch (error) {
    console.error('Error fetching user messages:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Validate session key
router.post('/validate-session', validateRequest, async (req, res) => {
  try {
    const { key } = req.body;

    // Check if the session key exists in the database
    const session = await Session.findOne({ where: { key } });

    if (session) {
      // If the session key is valid, return a success response
      res.status(200).send({ message: 'Session is valid', isValid: true });
    } else {
      // If the session key is invalid, return an error response
      res.status(401).send({ message: 'Invalid session key', isValid: false });
    }
  } catch (error) {
    console.error('Error validating session:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Search for user full data (excluding password)
router.post('/users/search', validateRequest, async (req, res) => {
  try {
    const { masterKey, username, phoneNumber } = req.body;

    // Validate the master key
    if (masterKey !== Master_key) {
      return res.status(401).send({ error: 'Unauthorized: Invalid master key' });
    }

    // Trim the username if provided
    const trimmedUsername = username ? username.trim() : null;

    // Find the user by username or phone number
    const user = await User.findOne({
      where: {
        [Sequelize.Op.or]: [{ username: trimmedUsername }, { phoneNumber }],
      },
    });

    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    // Return user data excluding the password
    const userResponse = { ...user.toJSON() };
    delete userResponse.password; // Remove the password field
    res.send({ user: userResponse });
  } catch (error) {
    console.error('Error searching for user:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Admin update username
router.post('/users/admin/update-credentials', validateRequest, async (req, res) => {
  try {
    const { masterKey, username, newUsername } = req.body;

    // Validate the master key
    if (masterKey !== Master_key) {
      return res.status(401).send({ error: 'Unauthorized: Invalid master key' });
    }

    // Trim the username
    const trimmedUsername = username.trim();

    // Find the user by username
    const user = await User.findOne({ where: { username: trimmedUsername } });
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    // Update username if provided
    if (newUsername) {
      // Trim the new username
      const trimmedNewUsername = newUsername.trim();

      // Check if the new username already exists
      const existingUser = await User.findOne({ where: { username: trimmedNewUsername } });
      if (existingUser) {
        return res.status(400).send({ error: 'Username already exists' });
      }
      user.username = trimmedNewUsername;
    }

    // Save the updated user
    await user.save();

    // Return the updated user data (excluding password)
    const userResponse = { ...user.toJSON() };
    delete userResponse.password; // Remove the password field
    res.send({ message: 'Username updated successfully', user: userResponse });
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Admin update display name
router.post('/users/admin/update-display-name', validateRequest, async (req, res) => {
  try {
    const { masterKey, username, newDisplayName } = req.body;

    // Validate the master key
    if (masterKey !== Master_key) {
      return res.status(401).send({ error: 'Unauthorized: Invalid master key' });
    }

    // Trim the username
    const trimmedUsername = username.trim();

    // Find the user by username
    const user = await User.findOne({ where: { username: trimmedUsername } });
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    // Validate the new display name
    if (!newDisplayName || newDisplayName.length < 3) {
      return res.status(400).send({ error: 'Display name must be at least 3 characters' });
    }

    // Update the display name
    user.displayName = newDisplayName;
    await user.save();

    // Return the updated user data (excluding password)
    const userResponse = { ...user.toJSON() };
    delete userResponse.password; // Remove the password field
    res.send({ message: 'Display name updated successfully', user: userResponse });
  } catch (error) {
    console.error('Error updating display name:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Admin update phone number
router.post('/users/admin/update-phone-number', validateRequest, async (req, res) => {
  try {
    const { masterKey, username, newPhoneNumber } = req.body;

    // Validate the master key
    if (masterKey !== Master_key) {
      return res.status(401).send({ error: 'Unauthorized: Invalid master key' });
    }

    // Trim the username
    const trimmedUsername = username.trim();

    // Find the user by username
    const user = await User.findOne({ where: { username: trimmedUsername } });
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    // Validate the new phone number
    if (!newPhoneNumber || !/^\d+$/.test(newPhoneNumber)) {
      return res.status(400).send({ error: 'Phone number must contain only numbers' });
    }

    // Check if the new phone number already exists
    const existingUserByPhoneNumber = await User.findOne({ where: { phoneNumber: newPhoneNumber } });
    if (existingUserByPhoneNumber) {
      return res.status(400).send({ error: 'Phone number already exists' });
    }

    // Update the phone number
    user.phoneNumber = newPhoneNumber;
    await user.save();

    // Return the updated user data (excluding password)
    const userResponse = { ...user.toJSON() };
    delete userResponse.password; // Remove the password field
    res.send({ message: 'Phone number updated successfully', user: userResponse });
  } catch (error) {
    console.error('Error updating phone number:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// Export the router
module.exports = router;