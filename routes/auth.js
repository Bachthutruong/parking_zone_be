const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').trim().isLength({ min: 10 }).withMessage('Please provide a valid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('licensePlate').optional().trim().isLength({ min: 1 }).withMessage('License plate is required')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

const updateProfileValidation = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('phone').optional().trim().isLength({ min: 10 }).withMessage('Please provide a valid phone number'),
  body('licensePlate').optional().trim().isLength({ min: 1 }).withMessage('License plate is required'),
  body('address').optional().trim().isLength({ min: 1 }).withMessage('Address is required')
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
];

// Routes
router.post('/register', registerValidation, handleValidationErrors, authController.register);
router.post('/login', loginValidation, handleValidationErrors, authController.login);
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, updateProfileValidation, handleValidationErrors, authController.updateProfile);
router.put('/change-password', auth, changePasswordValidation, handleValidationErrors, authController.changePassword);
router.get('/booking-terms', authController.getBookingTerms);

module.exports = router; 