const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { validateBooking, validateBookingSearch, validateCheckAvailability } = require('../middleware/validation');
const bookingController = require('../controllers/bookingController');

// Public routes
router.get('/available-parking-types', bookingController.getAvailableParkingTypes);
router.post('/check-availability', validateCheckAvailability, bookingController.checkAvailability);
router.post('/calculate-price', bookingController.calculatePrice);
router.post('/apply-discount', bookingController.applyDiscount);
router.post('/', bookingController.createBooking);
router.get('/search', bookingController.getBookingBySearch);
router.get('/:id', bookingController.getBookingDetails);

// Protected routes (require authentication)
router.use(auth);

// Admin/Staff routes
router.use(requireRole(['admin', 'staff']));

router.put('/:id/status', bookingController.updateBookingStatus);

module.exports = router; 