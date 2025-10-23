const express = require('express');
const router = express.Router();
const {
  getAllAutoDiscounts,
  getAutoDiscountById,
  createAutoDiscount,
  updateAutoDiscount,
  deleteAutoDiscount,
  toggleAutoDiscountStatus,
  getApplicableAutoDiscounts,
  getAutoDiscountStats
} = require('../controllers/autoDiscountController');
const { auth, requireRole } = require('../middleware/auth');

// Public routes
router.get('/applicable', getApplicableAutoDiscounts);

// Admin routes (require authentication and admin role)
router.get('/', auth, requireRole(['admin']), getAllAutoDiscounts);
router.get('/stats', auth, requireRole(['admin']), getAutoDiscountStats);
router.get('/:id', auth, requireRole(['admin']), getAutoDiscountById);
router.post('/', auth, requireRole(['admin']), createAutoDiscount);
router.put('/:id', auth, requireRole(['admin']), updateAutoDiscount);
router.delete('/:id', auth, requireRole(['admin']), deleteAutoDiscount);
router.patch('/:id/toggle', auth, requireRole(['admin']), toggleAutoDiscountStatus);

module.exports = router;
