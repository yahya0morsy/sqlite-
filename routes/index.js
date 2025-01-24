const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User.js');
const Session = require('../models/sessions.js');
const Account = require('../models/accounts.js');
const Master_key = require('../models/masterkey.js'); // Ensure this is properly exported
const Message = require('../models/message.js'); // Import the Message model
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



router.post('/users', validateRequest, async (req, res) => {
  try {
    const { displayName, username, password, phoneNumber } = req.body;

    // Check if all required fields are provided
    if (!displayName || !username || !password || !phoneNumber) {
      return res.status(400).send({ error: 'All fields are required: displayName, username, password, phoneNumber' });
    }

    // Validate displayName length (must be at least 3 characters)
    if (displayName.length < 3) {
      return res.status(400).send({ error: 'Display name must be at least 3 characters' });
    }

    // Validate username length (must be at least 4 characters)
    if (username.length < 4) {
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
    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      return res.status(400).send({ error: 'Username already exists' });
    }

    // Check if the phone number already exists
    const existingUserByPhoneNumber = await User.findOne({ phoneNumber });
    if (existingUserByPhoneNumber) {
      return res.status(400).send({ error: 'Phone number already exists' });
    }

    // Hash the password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create and save the new user
    const user = new User({ displayName, username, password: hashedPassword, phoneNumber });
    await user.save();

    // Create and save the associated account
    const account = new Account({ username, phoneNumber, accountBalance: 0 });
    await account.save();

    // Return the created user (excluding the password for security)
    const userResponse = { ...user.toObject() };
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
    const users = await User.find({}).limit(100); // Add pagination or limits
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

    if (!username && !phoneNumber) {
      return res.status(400).send({ error: 'Username or phone number is required' });
    }

    const user = await User.findOne({
      $or: [{ username }, { phoneNumber }],
    });

    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send({ error: 'Invalid password' });
    }

    let session = await Session.findOne({ username: user.username });

    if (!session) {
      const sessionKey = Math.random().toString(36).substring(2, 15); // Generate random session key
      session = new Session({ username: user.username, key: sessionKey });
      await session.save();
    }

    res.send({ key: session.key });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

router.post('/users/update-balance', validateRequest, async (req, res) => {
  try {
    const { masterKey, username, phoneNumber, amount, action } = req.body;

    // Validate the master key
    if (masterKey !== Master_key) {
      return res.status(401).send({ error: 'Unauthorized: Invalid master key' });
    }

    // Find the account by username or phone number
    const account = await Account.findOne({
      $or: [{ username }, { phoneNumber }],
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
    const message = new Message({
      username: account.username,
      content: `Your balance was updated from ${oldBalance} to ${account.accountBalance} by an admin.`,
      date: new Date(),
      time: new Date().toLocaleTimeString(),
    });
    await message.save();

    // Return success response
    res.send({ accountBalance: account.accountBalance });
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});
// Fetch account balance
// Fetch account balance and user grade
// Fetch account balance and user grade
router.post('/users/balance', validateRequest, async (req, res) => {
  try {
    const { key } = req.body;

    // Validate the session key
    const session = await Session.findOne({ key });
    if (!session) {
      return res.status(401).send({ error: 'Invalid session key' });
    }

    // Fetch the account (including balance and grade)
    const account = await Account.findOne({ username: session.username });
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

// ... (other routes remain unchanged)

router.post('/users/transfer-balance', validateRequest, async (req, res) => {
  try {
    const { senderKey, recipientUsername, amount } = req.body;

    // Validate that the amount is a positive integer
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).send({ error: 'Amount must be a positive integer' });
    }

    // Validate sender session
    const senderSession = await Session.findOne({ key: senderKey });
    if (!senderSession) {
      return res.status(401).send({ error: 'Invalid session key' });
    }

    // Validate sender account
    const senderAccount = await Account.findOne({ username: senderSession.username });
    if (!senderAccount) {
      return res.status(404).send({ error: 'Sender account not found' });
    }

    // Check if sender has sufficient balance
    if (senderAccount.accountBalance < amount) {
      return res.status(400).send({ error: 'Insufficient balance' });
    }

    // Find recipient account by username or phone number
    let recipientAccount = await Account.findOne({ username: recipientUsername });
    const recipientAccount2 = await Account.findOne({ phoneNumber: recipientUsername });

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

    // Perform the balance transfer
    senderAccount.accountBalance -= amount;
    recipientAccount.accountBalance += amount;

    // Save the updated account balances
    await senderAccount.save();
    await recipientAccount.save();

    // Create a message for the sender
    const senderMessage = new Message({
      username: senderSession.username,
      content: `You sent ${amount} to ${recipientAccount.username}.`,
      date: new Date(),
      time: new Date().toLocaleTimeString(),
    });
    await senderMessage.save();

    // Create a message for the recipient
    const recipientMessage = new Message({
      username: recipientAccount.username,
      content: `You received ${amount} from ${senderSession.username}.`,
      date: new Date(),
      time: new Date().toLocaleTimeString(),
    });
    await recipientMessage.save();

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

// ... (other routes remain unchanged)

module.exports = router;
// Update user grade (requires master key)
// Update user grade (requires master key)
router.post('/users/update-grade', validateRequest, async (req, res) => {
  try {
    const { masterKey, username, phoneNumber, grade } = req.body;

    // Validate the master key
    if (masterKey !== Master_key) {
      return res.status(401).send({ error: 'Unauthorized: Invalid master key' });
    }

    // Find the account by username or phone number
    const account = await Account.findOne({
      $or: [{ username }, { phoneNumber }],
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
    const message = new Message({
      username: account.username,
      content: `Your grade was updated from ${oldGrade} to ${grade} by an admin.`,
      date: new Date(),
      time: new Date().toLocaleTimeString(),
    });
    await message.save();

    // Return success response
    res.send({ message: 'Grade updated successfully', account });
  } catch (error) {
    console.error('Error updating grade:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});
router.post('/users/view-balance', async (req, res) => {
  try {
    const { masterKey, username, phoneNumber } = req.body;

    // Validate master key
    if (masterKey !== Master_key) {
      return res.status(401).json({ error: 'Unauthorized: Invalid master key' });
    }

    // Find account by username or phone number
    const account = await Account.findOne({
      $or: [{ username }, { phoneNumber }],
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
router.post('/users/update-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;

    // Find the user by username
    const user = await User.findOne({ username });
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
router.post('/users/admin/update-password', async (req, res) => {
  try {
    const { masterKey, username, newPassword } = req.body;

    // Validate the master key
    if (masterKey !== Master_key) {
      return res.status(401).json({ error: 'Unauthorized: Invalid master key' });
    }

    // Find the user by username
    const user = await User.findOne({ username });
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


// Endpoint to get user data using session key
router.post('/user-data', async (req, res) => {
  const { sessionKey } = req.body;

  if (!sessionKey) {
    return res.status(400).json({ error: 'Session key is required.' });
  }

  try {
    // Find the session by key
    const session = await Session.findOne({ key: sessionKey });

    if (!session) {
      return res.status(404).json({ error: 'Invalid session key.' });
    }

    // Find the user by username from the session
    const user = await User.findOne({ username: session.username });

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

router.post('/users/messages', validateRequest, async (req, res) => {
  try {
    const { key } = req.body; // Session key to identify the user

    // Validate the session key
    const session = await Session.findOne({ key });
    if (!session) {
      return res.status(401).send({ error: 'Invalid session key' });
    }

    // Fetch the latest 10 messages for the user
    const messages = await Message.find({ username: session.username })
      .sort({ date: -1, time: -1 }) // Sort by date and time in descending order
      .limit(10); // Limit to 10 messages

    // Return the messages
    res.send({ messages });
  } catch (error) {
    console.error('Error fetching user messages:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});
module.exports = router;
