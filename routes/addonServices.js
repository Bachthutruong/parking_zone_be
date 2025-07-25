const express = require('express');
const router = express.Router();
const addonServiceController = require('../controllers/addonServiceController');
const { auth, requireRole } = require('../middleware/auth');
const { validateAddonService, validateId } = require('../middleware/validation');

// Public routes
router.get('/', addonServiceController.getAllAddonServices);
router.get('/category/:category', addonServiceController.getServicesByCategory);
router.get('/:id', addonServiceController.getAddonServiceById);

// Admin/Staff routes
router.use(auth);
router.use(requireRole(['admin', 'staff']));

router.post('/', validateAddonService, addonServiceController.createAddonService);
router.put('/:id', validateId, addonServiceController.updateAddonService);
router.delete('/:id', validateId, addonServiceController.deleteAddonService);
router.patch('/:id/toggle', validateId, addonServiceController.toggleServiceStatus);
router.post('/initialize-defaults', addonServiceController.initializeDefaultServices);
router.put('/update-order', addonServiceController.updateServiceOrder);

module.exports = router; 