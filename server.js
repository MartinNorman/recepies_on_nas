const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const recipeRoutes = require('./routes/recipes');
const searchRoutes = require('./routes/search');
const menuRoutes = require('./routes/menus');
const shoppingListRoutes = require('./routes/shopping-lists');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Debug: Log all incoming API requests
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// Serve static files from public directory with cache control
// Disable caching for JavaScript files to prevent stale code issues
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      // Disable caching for JS files
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (path.endsWith('.html')) {
      // Disable caching for HTML files
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Serve images from images directory
const imagesPath = path.join(__dirname, 'images');
console.log('Images directory path:', imagesPath);
console.log('Images directory exists:', fs.existsSync(imagesPath));

// Test if a specific image exists
const testImagePath = path.join(imagesPath, '84380.jpg');
console.log('Test image path:', testImagePath);
console.log('Test image exists:', fs.existsSync(testImagePath));

// Serve images using static middleware
// Note: express.static serves files relative to the provided root path
app.use('/images', (req, res, next) => {
  console.log('Image request:', req.path);
  next();
}, express.static(imagesPath, {
  setHeaders: (res, filePath) => {
    // Allow caching for images
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

// Routes
app.use('/api/tables', recipeRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/shopping-lists', shoppingListRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Recipe search API is running' });
});

// Debug endpoint to test image path
app.get('/api/debug/image-path', (req, res) => {
  const testImage = path.join(__dirname, 'images', '84380.jpg');
  res.json({
    __dirname: __dirname,
    imagesPath: path.join(__dirname, 'images'),
    testImagePath: testImage,
    imagesExists: fs.existsSync(path.join(__dirname, 'images')),
    testImageExists: fs.existsSync(testImage),
    processCwd: process.cwd()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = config.server.port;
const HOST = '0.0.0.0'; // Listen on all network interfaces

app.listen(PORT, HOST, () => {
  console.log(`Recipe search server running on ${HOST}:${PORT}`);
  console.log(`Visit http://localhost:${PORT} to see the application`);
  console.log(`Or from network: http://<NAS-IP>:${PORT}`);
});

module.exports = app;
