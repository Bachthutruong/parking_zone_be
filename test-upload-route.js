const express = require('express');
const app = express();

// Test if upload route can be loaded
try {
  const uploadRoutes = require('./routes/upload');
  console.log('✅ Upload routes loaded successfully');
  
  // Test route registration
  app.use('/api/upload', uploadRoutes);
  console.log('✅ Upload routes registered successfully');
  
  // Test if routes are accessible
  const routes = [];
  uploadRoutes.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods);
      const path = middleware.route.path;
      routes.push(`${methods.join(', ').toUpperCase()} ${path}`);
    }
  });
  
  console.log('📋 Available routes:');
  routes.forEach(route => console.log(`  - ${route}`));
  
} catch (error) {
  console.error('❌ Error loading upload routes:', error.message);
}
