const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parkingController');
const { auth, requireRole } = require('../middleware/auth');
const { validateParkingLot, validateId } = require('../middleware/validation');

// Public routes
router.get('/', parkingController.getAllParkingLots);
router.get('/:id', parkingController.getParkingLotById);
router.get('/:id/availability', parkingController.getParkingLotAvailability);

// Admin/Staff routes
router.use(auth);
router.use(requireRole(['admin', 'staff']));

router.post('/', validateParkingLot, parkingController.createParkingLot);
router.put('/:id', validateId, parkingController.updateParkingLot);
router.delete('/:id', validateId, parkingController.deleteParkingLot);
router.post('/:id/special-prices', validateId, parkingController.addSpecialPrice);
router.delete('/:id/special-prices/:priceId', validateId, parkingController.removeSpecialPrice);

module.exports = router; 