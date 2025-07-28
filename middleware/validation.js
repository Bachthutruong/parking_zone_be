const { body, query, param, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }))
    });
  }
  next();
};

// Booking validation
const validateBooking = [
  body('parkingTypeId')
    .isMongoId()
    .withMessage('ID bãi đậu xe không hợp lệ'),
  
  body('checkInTime')
    .isISO8601()
    .withMessage('Thời gian vào bãi không hợp lệ'),
  
  body('checkOutTime')
    .isISO8601()
    .withMessage('Thời gian rời bãi không hợp lệ')
    .custom((value, { req }) => {
      const checkIn = new Date(req.body.checkInTime);
      const checkOut = new Date(value);
      if (checkOut <= checkIn) {
        throw new Error('Thời gian rời bãi phải sau thời gian vào bãi');
      }
      return true;
    }),
  
  body('driverName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên tài xế phải từ 2-100 ký tự'),
  
  body('phone')
    .trim()
    .matches(/^[+]?[\d\s\-\(\)]+$/)
    .withMessage('Số điện thoại không hợp lệ'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email không hợp lệ'),
  
  body('licensePlate')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Biển số xe không hợp lệ'),
  
  body('passengerCount')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Số hành khách phải từ 1-10'),
  
  body('luggageCount')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Số hành lý phải từ 0-20'),
  
  body('addonServices')
    .optional()
    .isArray()
    .withMessage('Dịch vụ bổ sung phải là mảng'),
  
  body('addonServices.*')
    .optional()
    .isMongoId()
    .withMessage('ID dịch vụ bổ sung không hợp lệ'),
  
  body('discountCode')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Mã giảm giá không hợp lệ'),
  
  body('estimatedArrivalTime')
    .optional()
    .isISO8601()
    .withMessage('Thời gian dự kiến đến không hợp lệ'),
  
  body('flightNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Số chuyến bay không hợp lệ'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Ghi chú không được quá 500 ký tự'),
  
  body('termsAccepted')
    .isBoolean()
    .withMessage('Phải đồng ý với điều khoản'),
  
  handleValidationErrors
];

// Search booking validation
const validateBookingSearch = [
  query('phone')
    .optional()
    .trim()
    .matches(/^[+]?[\d\s\-\(\)]+$/)
    .withMessage('Số điện thoại không hợp lệ'),
  
  query('licensePlate')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Biển số xe không hợp lệ'),
  
  query()
    .custom((value) => {
      if (!value.phone && !value.licensePlate) {
        throw new Error('Phải nhập số điện thoại hoặc biển số xe');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Check availability validation
const validateCheckAvailability = [
  body('parkingTypeId')
    .isMongoId()
    .withMessage('ID bãi đậu xe không hợp lệ'),
  
  body('checkInTime')
    .isISO8601()
    .withMessage('Thời gian vào bãi không hợp lệ'),
  
  body('checkOutTime')
    .isISO8601()
    .withMessage('Thời gian rời bãi không hợp lệ')
    .custom((value, { req }) => {
      const checkIn = new Date(req.body.checkInTime);
      const checkOut = new Date(value);
      if (checkOut <= checkIn) {
        throw new Error('Thời gian rời bãi phải sau thời gian vào bãi');
      }
      return true;
    }),
  
  handleValidationErrors
];

// User registration validation
const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên phải từ 2-100 ký tự'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email không hợp lệ'),
  
  body('phone')
    .trim()
    .matches(/^[+]?[\d\s\-\(\)]+$/)
    .withMessage('Số điện thoại không hợp lệ'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu phải chứa chữ hoa, chữ thường và số'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Mật khẩu xác nhận không khớp');
      }
      return true;
    }),
  
  handleValidationErrors
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email không hợp lệ'),
  
  body('password')
    .notEmpty()
    .withMessage('Mật khẩu không được để trống'),
  
  handleValidationErrors
];

// Parking lot validation
const validateParkingLot = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên bãi đậu xe phải từ 2-100 ký tự'),
  
  body('type')
    .isIn(['indoor', 'outdoor', 'disabled'])
    .withMessage('Loại bãi đậu xe không hợp lệ'),
  
  body('totalSpaces')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Tổng số chỗ đậu phải từ 1-1000'),
  
  body('basePrice')
    .isFloat({ min: 0 })
    .withMessage('Giá cơ bản phải là số dương'),
  
  body('pricePerDay')
    .isFloat({ min: 0 })
    .withMessage('Giá theo ngày phải là số dương'),
  
  handleValidationErrors
];

// Addon service validation
const validateAddonService = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên dịch vụ phải từ 2-100 ký tự'),
  
  body('icon')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Icon dịch vụ không hợp lệ'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Giá dịch vụ phải là số dương'),
  
  body('category')
    .optional()
    .isIn(['transport', 'cleaning', 'security', 'convenience', 'other'])
    .withMessage('Danh mục dịch vụ không hợp lệ'),
  
  handleValidationErrors
];

// Discount code validation
const validateDiscountCode = [
  body('code')
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Mã giảm giá phải từ 3-20 ký tự, chỉ chứa chữ hoa và số'),
  
  body('discountType')
    .isIn(['percentage', 'fixed'])
    .withMessage('Loại giảm giá không hợp lệ'),
  
  body('discountValue')
    .isFloat({ min: 0 })
    .withMessage('Giá trị giảm giá phải là số dương'),
  
  body('validFrom')
    .isISO8601()
    .withMessage('Ngày bắt đầu không hợp lệ'),
  
  body('validTo')
    .isISO8601()
    .withMessage('Ngày kết thúc không hợp lệ')
    .custom((value, { req }) => {
      const validFrom = new Date(req.body.validFrom);
      const validTo = new Date(value);
      if (validTo <= validFrom) {
        throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
      }
      return true;
    }),
  
  body('maxUsage')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Số lần sử dụng tối đa phải là số nguyên dương'),
  
  handleValidationErrors
];

// System settings validation
const validateSystemSettings = [
  body('bookingTerms')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Điều khoản đặt chỗ không được quá 2000 ký tự'),
  
  body('bookingRules')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Quy định đặt chỗ không được quá 2000 ký tự'),
  
  body('defaultVIPDiscount')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Giảm giá VIP mặc định phải từ 0-100%'),
  
  body('bookingAdvanceHours')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Thời gian đặt trước phải là số nguyên không âm'),
  
  body('maxBookingDays')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Số ngày đặt trước tối đa phải từ 1-365'),
  
  handleValidationErrors
];

// Parking type validation
const validateParkingType = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên bãi đậu xe phải từ 2-100 ký tự'),
  
  body('code')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Mã bãi đậu xe phải từ 1-20 ký tự'),
  
  body('type')
    .optional()
    .isIn(['indoor', 'outdoor', 'disabled'])
    .withMessage('Loại bãi đậu xe không hợp lệ'),
  
  body('totalSpaces')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Tổng số chỗ đậu phải từ 1-1000'),
  
  body('pricePerDay')
    .isFloat({ min: 0 })
    .withMessage('Giá theo ngày phải là số dương'),
  
  handleValidationErrors
];

// ID parameter validation
const validateId = [
  param('id')
    .isMongoId()
    .withMessage('ID không hợp lệ'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateBooking,
  validateBookingSearch,
  validateCheckAvailability,
  validateRegistration,
  validateLogin,
  validateParkingLot,
  validateAddonService,
  validateDiscountCode,
  validateSystemSettings,
  validateParkingType,
  validateId
}; 