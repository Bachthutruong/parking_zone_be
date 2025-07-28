const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parkingController');
const { validateParkingType } = require('../middleware/validation');
const { auth, requireRole } = require('../middleware/auth');

// Public routes
router.get('/', parkingController.getAllParkingTypes);
router.get('/:id', parkingController.getParkingTypeById);
router.get('/:id/availability', parkingController.getParkingTypeAvailability);

// Admin routes
router.post('/', auth, requireRole('admin'), validateParkingType, parkingController.createParkingType);
router.put('/:id', auth, requireRole('admin'), validateParkingType, parkingController.updateParkingType);
router.delete('/:id', auth, requireRole('admin'), parkingController.deleteParkingType);

module.exports = router; 