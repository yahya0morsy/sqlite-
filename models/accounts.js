const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  accountBalance: {
    type: Number,
    required: true,
    default: 0, // Default balance is 0
    min: 0, // Ensure balance is never negative
  },
  grade: {
    type: String, // Assuming grade is a string (e.g., "A", "B", "C")
    default: null, // Default value is null (empty)
  },
});

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;