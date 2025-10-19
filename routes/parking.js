const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parkingController');
const { validateParkingType } = require('../middleware/validation');
const { auth, requireRole } = require('../middleware/auth');
const { upload, processImages } = require('../middleware/upload');

// Public routes
router.get('/', parkingController.getAllParkingTypes);
router.get('/:id', parkingController.getParkingTypeById);
router.get('/:id/availability', parkingController.getParkingTypeAvailability);
router.get('/:id/month-availability', parkingController.getParkingTypeMonthAvailability);

// Admin routes
router.post('/', auth, requireRole('admin'), validateParkingType, parkingController.createParkingType);
router.put('/:id', auth, requireRole('admin'), validateParkingType, parkingController.updateParkingType);
router.delete('/:id', auth, requireRole('admin'), parkingController.deleteParkingType);

// Image management routes
router.post('/:id/images', auth, requireRole('admin'), upload.array('images', 10), processImages, parkingController.uploadImages);
router.delete('/:id/images/:imageId', auth, requireRole('admin'), parkingController.deleteImage);
router.put('/:id/images/order', auth, requireRole('admin'), parkingController.updateImageOrder);

module.exports = router; 