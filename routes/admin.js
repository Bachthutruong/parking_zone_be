const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');

// CORS middleware for all admin routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).send();
    return;
  }
  
  next();
});

// Public test routes (no auth required)
router.get('/test-public', (req, res) => {
  res.json({ message: '管理員公開路由正常運作' });
});

// CORS test route
router.patch('/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS 測試成功',
    method: req.method,
    headers: req.headers,
    body: req.body
  });
});

router.get('/parking-types/stats-public', adminController.getParkingTypeStats);

// Apply authentication and role middleware to all routes
router.use(auth);
router.use(requireRole(['admin', 'staff']));

// Debug middleware for VIP route (after auth)
router.patch('/users/:id/vip', (req, res, next) => {
  console.log('🔍 VIP Update Request:', {
    method: req.method,
    url: req.url,
    params: req.params,
    body: req.body,
    headers: {
      authorization: req.headers.authorization ? 'Bearer ***' : 'None',
      'content-type': req.headers['content-type'],
      origin: req.headers.origin
    }
  });
  next();
});

// Health check route for debugging
router.get('/health', (req, res) => {
  res.json({ 
    message: '管理員路由正常運作',
    user: req.user ? { id: req.user._id, role: req.user.role } : null,
    timestamp: new Date().toISOString()
  });
});

// Test route for debugging
router.get('/test', (req, res) => {
  res.json({ message: '管理員路由正常運作' });
});

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);
router.get('/bookings/stats/:period', adminController.getBookingStats);

// Bookings management
router.get('/bookings', adminController.getAllBookings);
router.get('/bookings/calendar', adminController.getCalendarBookings);
router.patch('/bookings/bulk-status', adminController.updateBulkBookingStatus);
router.patch('/bookings/:id/status', adminController.updateBookingStatus);
router.put('/bookings/:id', adminController.updateBooking);
router.delete('/bookings/:id', adminController.deleteBooking);
router.post('/bookings/manual', adminController.createManualBooking);

// Users management
router.get('/users/with-stats', adminController.getAllUsersWithStats);
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);

// VIP management
router.patch('/users/:id/vip', adminController.updateUserVIP);

router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
// Get user statistics
router.get('/users/:userId/stats', auth, requireRole('admin'), adminController.getUserStats);

// System settings
router.get('/settings', adminController.getSystemSettings);
router.put('/settings', adminController.updateSystemSettings);

// Parking lot statistics - moved before parking-types/:type to avoid route conflicts
router.get('/parking-types/stats', adminController.getParkingTypeStats);
router.get('/parking/current-status', adminController.getCurrentParkingStatus);

// Parking types management
router.get('/parking-types', adminController.getAllParkingTypes);
router.post('/parking-types', adminController.createParkingType);
router.put('/parking-types/:type', adminController.updateParkingType);
router.delete('/parking-types/:type', adminController.deleteParkingType);

// Addon services management
router.get('/addon-services', adminController.getAllAddonServices);
router.post('/addon-services', adminController.createAddonService);
router.put('/addon-services/:id', adminController.updateAddonService);
router.delete('/addon-services/:id', adminController.deleteAddonService);

// Discount codes management
router.get('/discount-codes', adminController.getAllDiscountCodes);
router.post('/discount-codes', adminController.createDiscountCode);
router.put('/discount-codes/:id', adminController.updateDiscountCode);
router.delete('/discount-codes/:id', adminController.deleteDiscountCode);

// ===== TERMS ROUTES =====
router.get('/terms', adminController.getAllTerms);
router.put('/terms/:section', adminController.updateTermsSection);
router.post('/terms/save-all', adminController.saveAllTerms);

// ===== NOTIFICATION TEMPLATE ROUTES =====
router.get('/notification-templates', adminController.getAllNotificationTemplates);
router.post('/notification-templates', adminController.createNotificationTemplate);
router.put('/notification-templates/:id', adminController.updateNotificationTemplate);
router.delete('/notification-templates/:id', adminController.deleteNotificationTemplate);

// ===== NOTIFICATION TEST ROUTES =====
router.post('/notifications/test', adminController.testNotification);
router.post('/notifications/bulk', adminController.sendBulkNotification);
router.get('/notifications/stats', adminController.getNotificationStats);

// ===== SPECIAL PRICING ROUTES =====
router.post('/parking-types/:parkingTypeId/special-prices', adminController.addSpecialPrice);
router.post('/parking-types/:parkingTypeId/special-prices/bulk', adminController.addBulkSpecialPrices);
router.put('/parking-types/:parkingTypeId/special-prices/:specialPriceId', adminController.updateSpecialPrice);
router.delete('/parking-types/:parkingTypeId/special-prices/:specialPriceId', adminController.deleteSpecialPrice);
router.get('/parking-types/:parkingTypeId/special-prices', adminController.getSpecialPrices);

module.exports = router; 