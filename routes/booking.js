const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { validateBooking } = require('../middleware/validation');
const DiscountCode = require('../models/DiscountCode');
const ParkingLot = require('../models/ParkingLot');
const AddonService = require('../models/AddonService');

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

// Apply discount code
router.post('/apply-discount', async (req, res) => {
  try {
    const { discountCode, parkingLotId, checkInTime, checkOutTime, addonServices } = req.body;

    if (!discountCode) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá không được để trống' });
    }

    // Find the discount code
    const discount = await DiscountCode.findOne({ 
      code: discountCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() }
    });

    if (!discount) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
    }

    // Check if discount code has usage limits
    if (discount.maxUsage && discount.usageCount >= discount.maxUsage) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng' });
    }

    // Calculate base price
    const parkingLot = await ParkingLot.findById(parkingLotId);
    if (!parkingLot) {
      return res.status(400).json({ success: false, message: 'Bãi đậu xe không tồn tại' });
    }

    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const durationMs = checkOut.getTime() - checkIn.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    const daysToCharge = Math.max(1, durationDays);

    let basePrice = 0;
    for (let i = 0; i < daysToCharge; i++) {
      const currentDate = new Date(checkIn);
      currentDate.setDate(currentDate.getDate() + i);
      basePrice += parkingLot.getPriceForDate(currentDate);
    }

    // Calculate addon services price
    let addonPrice = 0;
    if (addonServices && addonServices.length > 0) {
      const addonServicesData = await AddonService.find({ _id: { $in: addonServices } });
      addonPrice = addonServicesData.reduce((total, service) => total + service.price, 0);
    }

    const totalBeforeDiscount = basePrice + addonPrice;

    // Apply discount
    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (totalBeforeDiscount * discount.value) / 100;
    } else {
      discountAmount = Math.min(discount.value, totalBeforeDiscount);
    }

    const finalAmount = totalBeforeDiscount - discountAmount;

    res.json({
      success: true,
      discountInfo: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        description: discount.description,
        discountAmount,
        totalBeforeDiscount,
        finalAmount
      }
    });

  } catch (error) {
    console.error('Error applying discount:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi áp dụng mã giảm giá' });
  }
});

module.exports = router; 