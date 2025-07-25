const express = require('express');
const router = express.Router();
const { auth, requireAdmin } = require('../middleware/auth');
const {
  getSystemSettings,
  updateSystemSettings,
  getBookingTerms,
  updateBookingTerms,
  getParkingLotTypes,
  updateParkingLotTypes
} = require('../controllers/systemSettingsController');

// Public routes
router.get('/', getSystemSettings);
router.get('/booking-terms', getBookingTerms);
router.get('/parking-lot-types', getParkingLotTypes);

// Admin only routes
router.put('/', requireAdmin, updateSystemSettings);
router.put('/booking-terms', requireAdmin, updateBookingTerms);
router.put('/parking-lot-types', requireAdmin, updateParkingLotTypes);

module.exports = router; 