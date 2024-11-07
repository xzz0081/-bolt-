const express = require('express');
const app = express();

// Add these headers to your Express app
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval'");
  next();
});

// ... rest of the code ... 