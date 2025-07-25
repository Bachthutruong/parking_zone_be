const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { validateBooking } = require('../middleware/validation');

// Get booking terms and rules
router.get('/terms', bookingController.getBookingTerms);

// Check availability for specific parking lot and time
router.post('/check-availability', bookingController.checkAvailability);

// Get available parking lots by type
router.get('/available-lots', bookingController.getAvailableParkingLots);

// Calculate booking price
router.post('/calculate-price', bookingController.calculatePrice);

// Create booking
router.post('/', validateBooking, bookingController.createBooking);

// Get booking by search (phone/license plate)
router.get('/search', bookingController.getBookingBySearch);

// Get booking details
router.get('/:id', bookingController.getBookingDetails);

// Update booking status
router.patch('/:id/status', bookingController.updateBookingStatus);

module.exports = router; 