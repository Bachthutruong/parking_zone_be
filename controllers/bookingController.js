const Booking = require('../models/Booking');
const ParkingType = require('../models/ParkingType');
const AddonService = require('../models/AddonService');
const DiscountCode = require('../models/DiscountCode');
const AutoDiscount = require('../models/AutoDiscount');
const SystemSettings = require('../models/SystemSettings');
const User = require('../models/User');
const MaintenanceDay = require('../models/MaintenanceDay');
const notificationService = require('../utils/notificationService');

// Get booking terms and rules
exports.getBookingTerms = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json({
      terms: settings.bookingTerms,
      rules: settings.bookingRules,
      timeSlotInterval: settings.timeSlotInterval
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Check availability for specific parking type and time
exports.checkAvailability = async (req, res) => {
  try {
    const { parkingTypeId, checkInTime, checkOutTime } = req.body;
    
    if (!parkingTypeId || !checkInTime || !checkOutTime) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    if (!parkingType.isActive) {
      return res.json({
        success: false,
        message: 'Loại bãi đậu xe này hiện không hoạt động',
        availableSlots: [],
        pricing: null
      });
    }

    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);

    // Validate date range
    if (checkOut <= checkIn) {
      return res.status(400).json({ 
        success: false,
        message: 'Thời gian rời bãi phải sau thời gian vào bãi' 
      });
    }

    // Check if dates are in the future
    const now = new Date();
    if (checkIn < now) {
      return res.status(400).json({ 
        success: false,
        message: 'Thời gian vào bãi không thể trong quá khứ' 
      });
    }

    // Check for maintenance days that affect this specific parking type
    const maintenanceDays = await MaintenanceDay.getMaintenanceDaysForRange(checkIn, checkOut);
    const affectingMaintenanceDays = maintenanceDays.filter(md => 
      md.isActive && md.affectedParkingTypes.some(pt => pt._id.toString() === parkingType._id.toString())
    );
    
    if (affectingMaintenanceDays.length > 0) {
      return res.json({
        success: false,
        message: 'Bãi đậu xe này đang bảo trì trong thời gian đã chọn',
        maintenanceDays: affectingMaintenanceDays.map(md => ({
          date: md.date,
          reason: md.reason,
          description: md.description
        })),
        availableSlots: [],
        pricing: null
      });
    }

    // Count overlapping bookings for the specific time range
    const overlappingBookings = await Booking.countDocuments({
      parkingType: parkingType._id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
      $or: [
        // Bookings that overlap with the requested time range
        {
          checkInTime: { $lt: checkOut },
          checkOutTime: { $gt: checkIn }
        }
      ]
    });

    const actualAvailableSpaces = Math.max(0, parkingType.totalSpaces - overlappingBookings);
    const isAvailable = actualAvailableSpaces > 0;
    
    if (!isAvailable) {
      return res.json({
        success: false,
        message: 'Bãi đậu xe đã hết chỗ trong thời gian này',
        availableSlots: [],
        pricing: null,
        details: {
          totalSpaces: parkingType.totalSpaces,
          occupiedSpaces: overlappingBookings,
          availableSpaces: actualAvailableSpaces
        }
      });
    }

    // Calculate pricing using new day-based logic
    const pricing = await parkingType.calculatePriceForRange(checkIn, checkOut);

    res.json({
      success: true,
      availableSpaces: actualAvailableSpaces,
      availableSlots: [{
        parkingTypeId: parkingType._id,
        name: parkingType.name,
        type: parkingType.type,
        availableSpaces: actualAvailableSpaces
      }],
      pricing: {
        basePrice: pricing.pricePerDay,
        durationDays: pricing.durationDays,
        daysToCharge: pricing.daysToCharge,
        totalPrice: pricing.totalPrice,
        dailyPrices: pricing.dailyPrices
      },
      details: {
        totalSpaces: parkingType.totalSpaces,
        occupiedSpaces: overlappingBookings,
        availableSpaces: actualAvailableSpaces,
        occupancyRate: ((overlappingBookings / parkingType.totalSpaces) * 100).toFixed(1)
      }
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get available parking types by type
exports.getAvailableParkingTypes = async (req, res) => {
  try {
    const { type, checkInTime, checkOutTime } = req.query;
    
    if (!type || !checkInTime || !checkOutTime) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);

    // Get parking types of the specified type
    const parkingTypes = await ParkingType.find({ 
      type, 
      isActive: true 
    });

    // Check availability for each parking type
    const availableTypes = [];
    for (const parkingType of parkingTypes) {
      // Check for maintenance days that affect this parking type
      const maintenanceDays = await MaintenanceDay.getMaintenanceDaysForRange(checkIn, checkOut);
      const affectingMaintenanceDays = maintenanceDays.filter(md => 
        md.isActive && md.affectedParkingTypes.some(pt => pt._id.toString() === parkingType._id.toString())
      );
      
      // Skip if this parking type is under maintenance
      if (affectingMaintenanceDays.length > 0) {
        continue;
      }
      
      const isAvailable = await parkingType.isAvailableForTime(checkIn, checkOut);
      if (isAvailable) {
        // Calculate actual available spaces
        const overlappingBookings = await Booking.countDocuments({
          parkingType: parkingType._id,
          status: { $in: ['pending', 'confirmed', 'checked-in'] },
          $or: [
            {
              checkInTime: { $lt: checkOut },
              checkOutTime: { $gt: checkIn }
            },
            {
              checkInTime: { $gte: checkIn },
              checkOutTime: { $lte: checkOut }
            }
          ]
        });
        const actualAvailableSpaces = Math.max(0, parkingType.totalSpaces - overlappingBookings);
        
        const pricing = await parkingType.calculatePriceForRange(checkIn, checkOut);
        availableTypes.push({
          _id: parkingType._id,
          name: parkingType.name,
          type: parkingType.type,
          totalSpaces: parkingType.totalSpaces,
          availableSpaces: actualAvailableSpaces,
          pricePerDay: parkingType.pricePerDay,
          price: pricing.totalPrice,
          durationDays: pricing.durationDays,
          daysToCharge: pricing.daysToCharge,
          dailyPrices: pricing.dailyPrices,
          description: parkingType.description,
          features: parkingType.features
        });
      }
    }

    res.json({ parkingTypes: availableTypes });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Calculate booking price
exports.calculatePrice = async (req, res) => {
  try {
    const { 
      parkingTypeId, 
      checkInTime, 
      checkOutTime, 
      addonServices = [],
      discountCode = null,
      isVIP = false,
      userEmail = null
    } = req.body;

    if (!parkingTypeId || !checkInTime || !checkOutTime) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    // Calculate pricing using new day-based logic
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const pricing = await parkingType.calculatePriceForRange(checkIn, checkOut);

    // Calculate base price
    const totalBasePrice = pricing.totalPrice;

    // Calculate addon services price
    let addonTotal = 0;
    const addonDetails = [];
    
    for (const addonId of addonServices) {
      const addon = await AddonService.findById(addonId);
      if (addon && addon.isActive) {
        addonTotal += addon.price;
        addonDetails.push({
          service: addon._id,
          name: addon.name,
          price: addon.price,
          icon: addon.icon
        });
      }
    }

    // Calculate subtotal (base + addons)
    const subtotal = totalBasePrice + addonTotal;

    // Get user info for auto discount and VIP calculations
    let user = null;
    if (userEmail) {
      user = await User.findOne({ email: userEmail });
    }

    // Apply auto discounts first (highest priority)
    let autoDiscountAmount = 0;
    let autoDiscountInfo = null;
    
    const autoDiscounts = await AutoDiscount.find({
      isActive: true,
      applicableParkingTypes: parkingTypeId,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() }
    }).sort({ priority: -1 }); // Sort by priority (highest first)

    // Find the best auto discount that applies
    for (const autoDiscount of autoDiscounts) {
      const bookingData = {
        parkingTypeId,
        checkInTime,
        checkOutTime,
        totalAmount: subtotal,
        isVIP: isVIP,
        userId: user?._id,
        userRegistrationDate: user?.createdAt
      };

      if (autoDiscount.appliesToBooking(bookingData)) {
        autoDiscountAmount = autoDiscount.calculateDiscount(bookingData);
        autoDiscountInfo = {
          _id: autoDiscount._id,
          name: autoDiscount.name,
          description: autoDiscount.description,
          discountType: autoDiscount.discountType,
          discountValue: autoDiscount.discountValue,
          applyToSpecialPrices: autoDiscount.applyToSpecialPrices
        };
        break; // Use the first (highest priority) applicable discount
      }
    }

    // Calculate discount code (if no auto discount or auto discount allows it)
    let discountAmount = 0;
    let discountCodeInfo = null;

    if (discountCode && (!autoDiscountInfo || autoDiscountInfo.applyToSpecialPrices)) {
      const code = await DiscountCode.findOne({ 
        code: discountCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validTo: { $gte: new Date() }
      });

      if (code) {
        if (code.discountType === 'percentage') {
          discountAmount = subtotal * (code.discountValue / 100);
        } else {
          discountAmount = Math.min(code.discountValue, subtotal);
        }
        discountCodeInfo = {
          code: code.code,
          discountValue: code.discountValue,
          discountType: code.discountType
        };
      }
    }

    // Calculate VIP discount after other discounts
    let vipDiscount = 0;
    if (isVIP && user) {
      const vipDiscountPercent = user.vipDiscount || 0;
      
      if (vipDiscountPercent > 0) {
        const amountAfterDiscounts = subtotal - autoDiscountAmount - discountAmount;
        vipDiscount = amountAfterDiscounts * (vipDiscountPercent / 100);
      }
    }

    // Calculate final amounts
    const totalAmount = subtotal;
    const finalDiscount = autoDiscountAmount + discountAmount + vipDiscount;
    const finalAmount = Math.max(0, totalAmount - finalDiscount);

    res.json({
      success: true,
      pricing: {
        basePrice: totalBasePrice,
        addonTotal: addonTotal,
        autoDiscountAmount: autoDiscountAmount,
        discountAmount: discountAmount,
        vipDiscount: vipDiscount,
        totalAmount: totalAmount,
        finalAmount: finalAmount,
        durationDays: pricing.durationDays,
        daysToCharge: pricing.daysToCharge,
        dailyPrices: pricing.dailyPrices
      },
      addonDetails,
      autoDiscountInfo,
      discountCodeInfo
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Create booking
exports.createBooking = async (req, res) => {
  try {
    const {
      parkingTypeId,
      checkInTime,
      checkOutTime,
      driverName,
      phone,
      email,
      licensePlate,
      passengerCount,
      luggageCount,
      addonServices,
      discountCode,
      estimatedArrivalTime,
      flightNumber,
      notes,
      // termsAccepted,
      departureTerminal,
      returnTerminal
    } = req.body;

    // // Validate required fields
    // if (!termsAccepted) {
    //   return res.status(400).json({ message: 'Bạn phải đồng ý với các điều khoản' });
    // }

    // Check if user exists or create new user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: driverName,
        email,
        phone,
        licensePlate,
        password: Math.random().toString(36).slice(-8) // Generate random password
      });
    }

    // Check if parking type is still available
    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType || !parkingType.isActive) {
      return res.status(400).json({ message: 'Loại bãi đậu xe không khả dụng' });
    }

    // Check for maintenance days that affect this specific parking type
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    
    const maintenanceDays = await MaintenanceDay.getMaintenanceDaysForRange(checkIn, checkOut);
    const affectingMaintenanceDays = maintenanceDays.filter(md => 
      md.isActive && md.affectedParkingTypes.some(pt => pt._id.toString() === parkingType._id.toString())
    );
    
    if (affectingMaintenanceDays.length > 0) {
      return res.status(400).json({ 
        message: 'Bãi đậu xe này đang bảo trì trong thời gian đã chọn',
        maintenanceDays: affectingMaintenanceDays.map(md => ({
          date: md.date,
          reason: md.reason,
          description: md.description
        }))
      });
    }

    const isAvailable = await parkingType.isAvailableForTime(checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({ message: 'Bãi đậu xe đã hết chỗ trong thời gian này' });
    }

    // Calculate price
    const priceCalculation = await calculateBookingPrice({
      parkingTypeId,
      checkInTime,
      checkOutTime,
      addonServices,
      discountCode,
      isVIP: user.isVIP,
      userEmail: user.email,
      luggageCount
    });

    // Create booking
    const booking = await Booking.create({
      user: user._id,
      parkingType: parkingTypeId,
      checkInTime,
      checkOutTime,
      driverName,
      phone,
      email,
      licensePlate,
      passengerCount,
      luggageCount,
      addonServices: priceCalculation.addonDetails,
      discountCode: priceCalculation.discountCodeInfo,
      autoDiscount: priceCalculation.autoDiscountInfo,
      estimatedArrivalTime,
      flightNumber,
      notes,
      totalAmount: priceCalculation.totalAmount,
      discountAmount: priceCalculation.discountAmount,
      finalAmount: priceCalculation.finalAmount,
      isVIP: user.isVIP,
      vipDiscount: priceCalculation.vipDiscount,
      status: 'confirmed',
      paymentStatus: 'pending',
      paymentMethod: 'cash',
      departureTerminal,
      returnTerminal
    });

    // Update parking type availability
    await ParkingType.findByIdAndUpdate(parkingTypeId, {
      $inc: { availableSpaces: -1 }
    });

    // Populate user and parking type for notification
    await booking.populate('user parkingType');

    // Send notification
    try {
      const notificationResults = await notificationService.sendBookingConfirmation(booking, booking.user);
      console.log('Notification results:', notificationResults);
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // Don't fail the booking if notification fails
    }

    // Populate full booking data for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate('parkingType', 'name type location')
      .populate('addonServices.service', 'name icon price')
      .populate('user', 'name email phone');

    res.status(201).json({
      message: 'Đặt chỗ thành công',
      booking: {
        ...populatedBooking.toObject(),
        bookingNumber: populatedBooking.bookingNumber
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Create manual booking (for staff)
exports.createManualBooking = async (req, res) => {
  try {
    const {
      parkingTypeId,
      checkInTime,
      checkOutTime,
      driverName,
      phone,
      email,
      licensePlate,
      passengerCount = 1,
      luggageCount = 0,
      addonServices = [],
      discountCode,
      estimatedArrivalTime,
      flightNumber,
      notes,
      paymentStatus = 'pending',
      paymentMethod = 'cash',
      status = 'confirmed',
      departureTerminal,
      returnTerminal
    } = req.body;

    // Check if parking type is available
    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType || !parkingType.isActive) {
      return res.status(400).json({ message: 'Loại bãi đậu xe không khả dụng' });
    }

    // Check for maintenance days that affect this specific parking type
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    
    const maintenanceDays = await MaintenanceDay.getMaintenanceDaysForRange(checkIn, checkOut);
    const affectingMaintenanceDays = maintenanceDays.filter(md => 
      md.isActive && md.affectedParkingTypes.some(pt => pt._id.toString() === parkingType._id.toString())
    );
    
    if (affectingMaintenanceDays.length > 0) {
      return res.status(400).json({ 
        message: 'Bãi đậu xe này đang bảo trì trong thời gian đã chọn',
        maintenanceDays: affectingMaintenanceDays.map(md => ({
          date: md.date,
          reason: md.reason,
          description: md.description
        }))
      });
    }

    // Check availability
    const isAvailable = await parkingType.isAvailableForTime(checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({ message: 'Bãi đậu xe đã hết chỗ trong thời gian này' });
    }

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: driverName,
        email,
        phone,
        licensePlate,
        password: Math.random().toString(36).slice(-8)
      });
    }

    // Calculate price
    const priceCalculation = await calculateBookingPrice({
      parkingTypeId,
      checkInTime,
      checkOutTime,
      addonServices,
      discountCode,
      isVIP: user.isVIP,
      userEmail: user.email,
      luggageCount
    });

    // Create booking
    const booking = await Booking.create({
      user: user._id,
      parkingType: parkingTypeId,
      checkInTime,
      checkOutTime,
      driverName,
      phone,
      email,
      licensePlate,
      passengerCount,
      luggageCount,
      addonServices: priceCalculation.addonDetails,
      discountCode: priceCalculation.discountCodeInfo,
      autoDiscount: priceCalculation.autoDiscountInfo,
      estimatedArrivalTime,
      flightNumber,
      notes,
      totalAmount: priceCalculation.totalAmount,
      discountAmount: priceCalculation.discountAmount,
      finalAmount: priceCalculation.finalAmount,
      isVIP: user.isVIP,
      vipDiscount: priceCalculation.vipDiscount,
      paymentStatus,
      paymentMethod,
      status,
      departureTerminal,
      returnTerminal,
      isManualBooking: true,
      createdBy: req.user._id
    });

    // Update parking type availability
    await ParkingType.findByIdAndUpdate(parkingTypeId, {
      $inc: { availableSpaces: -1 }
    });

    // Populate booking data
    const populatedBooking = await Booking.findById(booking._id)
      .populate('parkingType', 'name type location')
      .populate('addonServices.service', 'name icon price')
      .populate('user', 'name email phone')
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Tạo đặt chỗ thủ công thành công',
      booking: populatedBooking
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(id).populate('user parkingType');
    
    if (!booking) {
      return res.status(404).json({ 
        message: 'Không tìm thấy đặt chỗ' 
      });
    }

    if (booking.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Không có quyền hủy đặt chỗ này' 
      });
    }

    // Calculate refund amount
    const refundAmount = booking.totalAmount;

    // Update booking status
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelReason = reason || 'Hủy bởi khách hàng';
    await booking.save();

    // Send cancellation notification
    try {
      const notificationResults = await notificationService.sendCancellationNotification(booking, booking.user, refundAmount);
      console.log('Cancellation notification results:', notificationResults);
    } catch (notificationError) {
      console.error('Error sending cancellation notification:', notificationError);
    }

    res.json({
      message: 'Hủy đặt chỗ thành công',
      refundAmount,
      booking
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Get booking by phone and license plate
exports.getBookingBySearch = async (req, res) => {
  try {
    const { phone, licensePlate } = req.query;

    if (!phone && !licensePlate) {
      return res.status(400).json({ message: 'Vui lòng nhập số điện thoại hoặc biển số xe' });
    }

    const query = {};
    if (phone) query.phone = phone;
    if (licensePlate) query.licensePlate = licensePlate;

    const bookings = await Booking.find(query)
      .populate('parkingType', 'name type')
      .populate('addonServices.service', 'name icon price')
      .sort({ createdAt: -1 })
      .limit(10);

    // Add bookingNumber to each booking
    const bookingsWithNumber = bookings.map(booking => ({
      ...booking.toObject(),
      bookingNumber: booking.bookingNumber
    }));

    res.json({ bookings: bookingsWithNumber });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get booking details
exports.getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('parkingType', 'name type description location')
      .populate('addonServices.service', 'name icon price description')
      .populate('user', 'name email phone isVIP');

    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy đặt chỗ' });
    }

    res.json({ 
      booking: {
        ...booking.toObject(),
        bookingNumber: booking.bookingNumber
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy đặt chỗ' });
    }

    // Update status and timestamps
    const updateData = { status };
    if (status === 'checked-in' && !booking.actualCheckInTime) {
      updateData.actualCheckInTime = new Date();
    }
    if (status === 'checked-out' && !booking.actualCheckOutTime) {
      updateData.actualCheckOutTime = new Date();
    }
    if (notes) {
      updateData.notes = notes;
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('parkingType', 'name type');

    res.json({
      message: 'Cập nhật trạng thái thành công',
      booking: {
        ...updatedBooking.toObject(),
        bookingNumber: updatedBooking.bookingNumber
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Helper function to calculate booking price
async function calculateBookingPrice({
  parkingTypeId,
  checkInTime,
  checkOutTime,
  addonServices = [],
  discountCode = null,
  isVIP = false,
  userEmail = null,
  luggageCount = 0
}) {
  const parkingType = await ParkingType.findById(parkingTypeId);
  if (!parkingType) {
    throw new Error('Không tìm thấy loại bãi đậu xe');
  }

  const checkIn = new Date(checkInTime);
  const checkOut = new Date(checkOutTime);
  
  // Calculate pricing using new day-based logic
  const pricing = await parkingType.calculatePriceForRange(checkIn, checkOut);
  const totalBasePrice = pricing.totalPrice;

  // Calculate addon services
  let addonTotal = 0;
  const addonDetails = [];
  
  for (const addonId of addonServices) {
    const addon = await AddonService.findById(addonId);
    if (addon && addon.isActive) {
      addonTotal += addon.price;
      addonDetails.push({
        service: addon._id,
        name: addon.name,
        price: addon.price,
        icon: addon.icon
      });
    }
  }

  // Calculate luggage fees
  let luggageTotal = 0;
  let luggageDetails = null;
  
  if (luggageCount > 0) {
    const settings = await SystemSettings.getSettings();
    const { freeLuggageCount, luggagePricePerItem } = settings.luggageSettings;
    
    const additionalLuggage = Math.max(0, luggageCount - freeLuggageCount);
    luggageTotal = additionalLuggage * luggagePricePerItem;
    
    if (luggageTotal > 0) {
      luggageDetails = {
        freeLuggageCount,
        additionalLuggage,
        pricePerItem: luggagePricePerItem,
        total: luggageTotal
      };
    }
  }

  // Calculate subtotal (base + addons + luggage)
  const subtotal = totalBasePrice + addonTotal + luggageTotal;

  // Get user info for auto discount and VIP calculations
  let user = null;
  if (userEmail) {
    user = await User.findOne({ email: userEmail });
  }

  // Apply auto discounts first (highest priority)
  let autoDiscountAmount = 0;
  let autoDiscountInfo = null;
  
  const autoDiscounts = await AutoDiscount.find({
    isActive: true,
    applicableParkingTypes: parkingTypeId,
    validFrom: { $lte: new Date() },
    validTo: { $gte: new Date() }
  }).sort({ priority: -1 }); // Sort by priority (highest first)

  // Find the best auto discount that applies
  for (const autoDiscount of autoDiscounts) {
    const bookingData = {
      parkingTypeId,
      checkInTime,
      checkOutTime,
      totalAmount: subtotal,
      isVIP: isVIP,
      userId: user?._id,
      userRegistrationDate: user?.createdAt
    };

    if (autoDiscount.appliesToBooking(bookingData)) {
      autoDiscountAmount = autoDiscount.calculateDiscount(bookingData);
      autoDiscountInfo = {
        _id: autoDiscount._id,
        name: autoDiscount.name,
        description: autoDiscount.description,
        discountType: autoDiscount.discountType,
        discountValue: autoDiscount.discountValue,
        applyToSpecialPrices: autoDiscount.applyToSpecialPrices
      };
      break; // Use the first (highest priority) applicable discount
    }
  }

  // Apply discount code (if no auto discount or auto discount allows it)
  let discountAmount = 0;
  let discountCodeInfo = null;

  if (discountCode && (!autoDiscountInfo || autoDiscountInfo.applyToSpecialPrices)) {
    const code = await DiscountCode.findOne({ 
      code: discountCode.toUpperCase().trim(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() }
    });

    if (code) {
      // Check usage limit
      if (code.maxUsage && code.usageCount >= code.maxUsage) {
        throw new Error('Mã giảm giá đã hết lượt sử dụng');
      }

      if (code.discountType === 'percentage') {
        discountAmount = subtotal * (code.discountValue / 100);
      } else {
        discountAmount = Math.min(code.discountValue, subtotal); // Don't discount more than subtotal
      }
      
      discountCodeInfo = {
        code: code.code,
        discountValue: code.discountValue,
        discountType: code.discountType
      };
    }
  }

  // Apply VIP discount after other discounts
  let vipDiscount = 0;
  if (isVIP && user) {
    const vipDiscountPercent = user.vipDiscount || 0;
    
    if (vipDiscountPercent > 0) {
      const amountAfterDiscounts = subtotal - autoDiscountAmount - discountAmount;
      vipDiscount = amountAfterDiscounts * (vipDiscountPercent / 100);
    }
  }

  // Calculate final amounts
  const totalAmount = subtotal;
  const finalDiscount = autoDiscountAmount + discountAmount + vipDiscount;
  const finalAmount = Math.max(0, totalAmount - finalDiscount); // Ensure final amount is not negative

  return {
    totalAmount,
    autoDiscountAmount,
    discountAmount,
    vipDiscount,
    finalAmount,
    addonDetails,
    luggageDetails,
    autoDiscountInfo,
    discountCodeInfo,
    pricing: {
      basePrice: totalBasePrice,
      addonTotal: addonTotal,
      luggageTotal: luggageTotal,
      subtotal: subtotal,
      durationDays: pricing.durationDays,
      daysToCharge: pricing.daysToCharge,
      dailyPrices: pricing.dailyPrices
    }
  };
}

// Get today's check-ins and check-outs
exports.getTodayBookings = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get check-ins today
    const checkInsToday = await Booking.find({
      checkInTime: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      status: { $in: ['confirmed', 'checked-in'] }
    })
    .populate('parkingType', 'name code')
    .populate('user', 'name phone')
    .sort({ checkInTime: 1 });

    // Get check-outs today
    const checkOutsToday = await Booking.find({
      checkOutTime: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      status: { $in: ['checked-in', 'checked-out'] }
    })
    .populate('parkingType', 'name code')
    .populate('user', 'name phone')
    .sort({ checkOutTime: 1 });

    // Get overdue bookings
    const overdueBookings = await Booking.find({
      checkOutTime: { $lt: today },
      status: 'checked-in'
    })
    .populate('parkingType', 'name code')
    .populate('user', 'name phone')
    .sort({ checkOutTime: 1 });

    // Add bookingNumber to all bookings
    const addBookingNumber = (bookings) => {
      return bookings.map(booking => ({
        ...booking.toObject(),
        bookingNumber: booking.bookingNumber
      }));
    };

    res.json({
      checkInsToday: addBookingNumber(checkInsToday),
      checkOutsToday: addBookingNumber(checkOutsToday),
      overdueBookings: addBookingNumber(overdueBookings),
      summary: {
        totalCheckIns: checkInsToday.length,
        totalCheckOuts: checkOutsToday.length,
        totalOverdue: overdueBookings.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Apply discount code
exports.applyDiscount = async (req, res) => {
  try {
    const { discountCode, parkingTypeId, checkInTime, checkOutTime, addonServices = [], isVIP = false } = req.body;
    
    if (!discountCode || !parkingTypeId || !checkInTime || !checkOutTime) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu thông tin cần thiết' 
      });
    }

    // Find the discount code
    const code = await DiscountCode.findOne({ 
      code: discountCode.toUpperCase().trim(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() }
    });

    if (!code) {
      return res.json({
        success: false,
        message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn'
      });
    }

    // Check if code usage limit exceeded
    if (code.maxUsage && code.usageCount >= code.maxUsage) {
      return res.json({
        success: false,
        message: 'Mã giảm giá đã hết lượt sử dụng'
      });
    }

    // Calculate pricing with VIP status
    const pricing = await calculateBookingPrice({
      parkingTypeId,
      checkInTime,
      checkOutTime,
      addonServices,
      discountCode: code.code,
      isVIP: isVIP,
      userEmail: req.body.userEmail || null,
      luggageCount: req.body.luggageCount || 0
    });

    if (pricing.discountAmount <= 0) {
      return res.json({
        success: false,
        message: 'Mã giảm giá không áp dụng được cho đơn hàng này'
      });
    }

    res.json({
      success: true,
      message: 'Áp dụng mã giảm giá thành công',
      discountInfo: {
        code: code.code,
        discountAmount: pricing.discountAmount,
        vipDiscount: pricing.vipDiscount,
        discountType: code.discountType,
        discountValue: code.discountValue,
        finalAmount: pricing.finalAmount,
        originalAmount: pricing.totalAmount,
        totalDiscount: pricing.discountAmount + pricing.vipDiscount
      }
    });

  } catch (error) {
    console.error('Error applying discount:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

module.exports = exports; 