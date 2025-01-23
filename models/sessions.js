const mongoose = require('mongoose');

// Define the Session Schema
const sessionSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
   
  },
  key: {
    type: String,
    required: true,
    unique: true,
  },
  //createdAt: {
    //type: Date,
    //default: Date.now,
    //index: { expires: '2d' }}
});

// Create the Session model
const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;