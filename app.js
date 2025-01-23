var createError = require('http-errors');
var express = require('express');
var path = require('path');

var logger = require('morgan');
//const generateKeyMiddleware = require('./generateKeyMiddleware.js'); // Import the middleware
const mongoose = require('mongoose');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const cors = require('cors'); // Import the cors package
var app = express();

const mongoURI = 'mongodb+srv://moataz:moataz666@cluster1.bypno.mongodb.net/'; // Replace with your MongoDB URI
mongoose
  .connect(mongoURI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));


// List of allowed origins
const allowedOrigins = ['https://bonus-front.vercel.app/#/login', 'http://localhost:5173', 'https://bonus-front.vercel.app/'];

// Custom CORS configuration
const corsOptions = {
  origin: allowedOrigins, // Allow requests from these origins
  methods: 'GET,POST,PUT,DELETE', // Allow only specific HTTP methods
  //allowedHeaders: 'Content-Type,Authorization', // Allow only specific headers
};

// Enable CORS with custom options
app.use(cors(corsOptions));  


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
//app.use(generateKeyMiddleware);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
