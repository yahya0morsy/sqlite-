// Function to generate a random key
function generateRandomKey(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*';
  let result = '';

  // Validate the length parameter
  if (typeof length !== 'number' || length <= 0) {
      throw new Error('Invalid length parameter. Length must be a positive number.');
  }

  for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Middleware to generate a random 15-character key
const generateKeyMiddleware = (req, res, next) => {
  try {
      const randomKey = generateRandomKey(10); // Generate a 10-character key
      req.requestId = randomKey; // Attach the key to the request object
      console.log(`Request ID: ${randomKey}`); // Log the key (optional)
      next(); // Pass control to the next middleware/route handler
  } catch (error) {
      console.error('Error generating random key:', error.message);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

module.exports = generateKeyMiddleware;