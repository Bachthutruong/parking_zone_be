const express = require('express');
const router = express.Router();
const { auth, requireAdmin } = require('../middleware/auth');
const {
  getSystemSettings,
  updateSystemSettings,
  getBookingTerms,
  updateBookingTerms
} = require('../controllers/systemSettingsController');

// Public routes
router.get('/', getSystemSettings);
router.get('/booking-terms', getBookingTerms);

// Admin only routes
router.put('/', requireAdmin, updateSystemSettings);
router.put('/booking-terms', requireAdmin, updateBookingTerms);

module.exports = router; 