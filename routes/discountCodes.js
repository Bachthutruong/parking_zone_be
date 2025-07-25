const express = require('express');
const router = express.Router();
const discountCodeController = require('../controllers/discountCodeController');
const { auth, requireRole } = require('../middleware/auth');
const { validateDiscountCode, validateId } = require('../middleware/validation');

// Public routes
router.get('/active', discountCodeController.getActiveDiscountCodes);
router.post('/validate', discountCodeController.validateDiscountCode);

// Admin/Staff routes
router.use(auth);
router.use(requireRole(['admin', 'staff']));

router.get('/', discountCodeController.getAllDiscountCodes);
router.get('/:id', validateId, discountCodeController.getDiscountCodeById);
router.get('/:id/stats', validateId, discountCodeController.getDiscountCodeStats);
router.post('/', validateDiscountCode, discountCodeController.createDiscountCode);
router.put('/:id', validateId, discountCodeController.updateDiscountCode);
router.delete('/:id', validateId, discountCodeController.deleteDiscountCode);
router.patch('/:id/toggle', validateId, discountCodeController.toggleDiscountCodeStatus);

module.exports = router; 