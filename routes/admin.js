const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');

// Apply authentication and role middleware to all routes
router.use(auth);
router.use(requireRole(['admin', 'staff']));

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);
router.get('/bookings/stats/:period', adminController.getBookingStats);

// Bookings management
router.get('/bookings', adminController.getAllBookings);
router.patch('/bookings/:id/status', adminController.updateBookingStatus);
router.post('/bookings/manual', adminController.createManualBooking);

// Users management
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id/vip', adminController.updateUserVIP);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// System settings
router.get('/settings', adminController.getSystemSettings);
router.put('/settings', adminController.updateSystemSettings);

// Parking lot statistics
router.get('/parking-lots/stats', adminController.getParkingLotStats);
router.get('/parking/current-status', adminController.getCurrentParkingStatus);

// Parking lots management
router.get('/parking-lots', adminController.getAllParkingLots);
router.post('/parking-lots', adminController.createParkingLot);
router.put('/parking-lots/:id', adminController.updateParkingLot);
router.delete('/parking-lots/:id', adminController.deleteParkingLot);

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

module.exports = router; 