const mongoose = require('mongoose');

// Define the User Schema
const userSchema = new mongoose.Schema({
  displayName: {
    type: String,
    required: true,
    
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },

  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
   
  },
});


const User = mongoose.model('User', userSchema);

module.exports = User;