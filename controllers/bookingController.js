const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const ParkingType = require('../models/ParkingType');
const AddonService = require('../models/AddonService');
const DiscountCode = require('../models/DiscountCode');
const AutoDiscount = require('../models/AutoDiscount');
const SystemSettings = require('../models/SystemSettings');
const User = require('../models/User');
const MaintenanceDay = require('../models/MaintenanceDay');
const notificationService = require('../utils/notificationService');

const TAIWAN_TZ = 'Asia/Taipei';

/** Get YYYY-MM-DD in Taiwan for a Date (for consistent calendar-day logic with frontend) */
function toTaiwanDateStr(d) {
  return d.toLocaleDateString('en-CA', { timeZone: TAIWAN_TZ });
}

/** Next calendar day in Taiwan (YYYY-MM-DD) */
function nextTaiwanDay(dayStr) {
  const d = new Date(dayStr + 'T12:00:00+08:00');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: TAIWAN_TZ });
}

// Get booking terms and rules
exports.getBookingTerms = async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'MongoDB 未連線，請檢查資料庫連線' 
      });
    }
    
    const settings = await SystemSettings.getSettings();
    res.json({
      terms: settings.bookingTerms,
      rules: settings.bookingRules,
      timeSlotInterval: settings.timeSlotInterval
    });
  } catch (error) {
    console.error('Error getting booking terms:', error);
    res.status(500).json({ 
      message: '伺服器錯誤', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};

// Check availability for specific parking type and time
exports.checkAvailability = async (req, res) => {
  try {
    const { parkingTypeId, checkInTime, checkOutTime, excludeBookingId } = req.body;
    
    if (!parkingTypeId || !checkInTime || !checkOutTime) {
      return res.status(400).json({ message: '缺少必要資訊' });
    }

    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    if (!parkingType.isActive) {
      return res.json({
        success: false,
        message: '此停車場目前未營運',
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
        message: '離開時間必須在進入時間之後' 
      });
    }

    // Check if dates are in the future (skip when editing: excludeBookingId = allow past checkIn for pricing)
    const now = new Date();
    if (!excludeBookingId && checkIn < now) {
      return res.status(400).json({ 
        success: false,
        message: '進入時間不能是過去時間' 
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
        message: '此期間停車場正在維護',
        maintenanceDays: affectingMaintenanceDays.map(md => ({
          date: md.date,
          reason: md.reason,
          description: md.description
        })),
        availableSlots: [],
        pricing: null
      });
    }

    // Fetch all overlapping bookings (same filter as calendar / getParkingTypeMonthAvailability)
    const matchQuery = {
      parkingType: parkingType._id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
      isDeleted: { $ne: true },
      checkInTime: { $lt: checkOut },
      checkOutTime: { $gt: checkIn }
    };
    if (excludeBookingId && mongoose.Types.ObjectId.isValid(excludeBookingId)) {
      matchQuery._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
    }
    const overlappingList = await Booking.find(matchQuery)
      .select('checkInTime checkOutTime vehicleCount _id')
      .lean();

    // Compute occupancy per Taiwan calendar day and take MAX — same logic as calendar "min available"
    // So "còn ít nhất 2 chỗ" = every Taiwan day has at least 2 free = maxOccupied <= totalSpaces - 2
    const perDayOccupancy = [];
    let maxOccupied = 0;
    let dayStr = toTaiwanDateStr(checkIn);
    const endDayStr = toTaiwanDateStr(checkOut);

    while (dayStr <= endDayStr) {
      const startOfDay = new Date(dayStr + 'T00:00:00.000+08:00');
      const endOfDay = new Date(dayStr + 'T23:59:59.999+08:00');

      const occupiedThisDay = overlappingList
        .filter(b => b.checkInTime < endOfDay && b.checkOutTime > startOfDay)
        .reduce((sum, b) => sum + (b.vehicleCount ?? 1), 0);

      perDayOccupancy.push({
        day: dayStr,
        occupied: occupiedThisDay
      });
      maxOccupied = Math.max(maxOccupied, occupiedThisDay);
      dayStr = nextTaiwanDay(dayStr);
    }

    const selectedRange = { from: toTaiwanDateStr(checkIn), to: toTaiwanDateStr(checkOut) };
    const fullDays = perDayOccupancy
      .filter(d => d.occupied >= parkingType.totalSpaces)
      .map(d => d.day);

    const usedSpaces = maxOccupied;
    const actualAvailableSpaces = Math.max(0, parkingType.totalSpaces - usedSpaces);
    const vehicleCountNeeded = req.body.vehicleCount || 1;
    const isAvailable = actualAvailableSpaces >= vehicleCountNeeded;

    const wantDebug = req.body.debug === true || req.body.debug === 'true' || req.query.debug === 'true';
    const oldMethodUsedSpaces = overlappingList.reduce((sum, b) => sum + (b.vehicleCount ?? 1), 0);

    if (wantDebug) {
      console.log('[checkAvailability]', {
        parkingTypeId: parkingType._id.toString(),
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        excludeBookingId: excludeBookingId || null,
        totalSpaces: parkingType.totalSpaces,
        perDayOccupancy,
        maxOccupied: usedSpaces,
        actualAvailableSpaces,
        vehicleCountNeeded,
        isAvailable,
        oldMethodUsedSpaces
      });
    }

    if (!isAvailable) {
      const payload = {
        success: false,
        message: '此期間停車場已滿',
        availableSlots: [],
        pricing: null,
        details: {
          totalSpaces: parkingType.totalSpaces,
          occupiedSpaces: usedSpaces,
          availableSpaces: actualAvailableSpaces
        },
        selectedRange: { from: selectedRange.from, to: selectedRange.to },
        fullDays
      };
      if (wantDebug) payload.debug = { perDayOccupancy, maxOccupied: usedSpaces, oldMethodUsedSpaces };
      return res.json(payload);
    }

    // Calculate pricing using new day-based logic
    const pricing = await parkingType.calculatePriceForRange(checkIn, checkOut);

    const payload = {
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
        occupiedSpaces: usedSpaces,
        availableSpaces: actualAvailableSpaces,
        occupancyRate: ((usedSpaces / parkingType.totalSpaces) * 100).toFixed(1)
      }
    };
    if (wantDebug) payload.debug = { perDayOccupancy, maxOccupied: usedSpaces, oldMethodUsedSpaces };
    res.json(payload);
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Get available parking types by type
exports.getAvailableParkingTypes = async (req, res) => {
  try {
    const { type, checkInTime, checkOutTime } = req.query;
    
    if (!type || !checkInTime || !checkOutTime) {
      return res.status(400).json({ message: '缺少必要資訊' });
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
        // Calculate actual available spaces
        const overlappingBookings = await Booking.aggregate([
          {
            $match: {
              parkingType: parkingType._id,
              status: { $in: ['pending', 'confirmed', 'checked-in'] },
              isDeleted: { $ne: true },
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
            }
          },
          {
            $group: {
              _id: null,
              totalVehicles: { $sum: { $ifNull: ["$vehicleCount", 1] } }
            }
          }
        ]);

        const usedSpaces = overlappingBookings.length > 0 ? overlappingBookings[0].totalVehicles : 0;
        const actualAvailableSpaces = Math.max(0, parkingType.totalSpaces - usedSpaces);
        
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
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
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
      userEmail = null,
      phone = null,
      vehicleCount = 1
    } = req.body;

    if (!parkingTypeId || !checkInTime || !checkOutTime) {
      return res.status(400).json({ message: '缺少必要資訊' });
    }

    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    // Calculate pricing using new day-based logic
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const pricing = await parkingType.calculatePriceForRange(checkIn, checkOut);

    // Calculate base price
    // Multiply by number of vehicles
    const count = Math.max(1, parseInt(vehicleCount) || 1);
    const totalBasePrice = pricing.totalPrice * count;

    // Calculate addon services price
    let addonTotal = 0;
    const addonDetails = [];
    
    for (const addonId of addonServices) {
      const addon = await AddonService.findById(addonId);
      if (addon && addon.isActive) {
        // Addons are charged per vehicle usually, or per booking?
        // Assuming per vehicle as per user instruction "calculating accurately based on quantity read"
        // and usually each car needs its own service.
        const addonPrice = addon.price * count;
        addonTotal += addonPrice;
        addonDetails.push({
          service: addon._id,
          name: addon.name,
          price: addonPrice,
          icon: addon.icon
        });
      }
    }

    // Calculate subtotal (base + addons)
    const subtotal = totalBasePrice + addonTotal;

    // Get user info for auto discount and VIP calculations
    let user = null;
    if (phone) {
      user = await User.findOne({ phone });
    } else if (userEmail) {
      user = await User.findOne({ email: userEmail });
    }

    // Apply auto discounts first (highest priority)
    let autoDiscountAmount = 0;
    let autoDiscountInfo = null;
    
    // If we found a user, use their status for VIP
    const userIsVIP = user ? user.isVIP : isVIP;

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
        isVIP: userIsVIP,
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
    // Get vipDiscount percentage from user or from passed parameter
    const passedVipDiscount = Number(req.body.vipDiscount) || 0;
    
    if (userIsVIP) {
      let vipDiscountPercent = 0;
      
      if (user) {
        // Use user's vipDiscount if user exists
        vipDiscountPercent = user.vipDiscount || 0;
      } else if (passedVipDiscount > 0) {
        // Use passed vipDiscount if user doesn't exist (for new VIP customer)
        vipDiscountPercent = passedVipDiscount;
      } else {
        // Default VIP discount when no user and no passed value
        vipDiscountPercent = 12; // Default 12%
      }
      
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
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
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
      vehicleCount = 1,
      luggageCount,
      departurePassengerCount = 0,
      departureLuggageCount = 0,
      returnPassengerCount = 0,
      returnLuggageCount = 0,
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
    // Check if user exists or create new user
    let user = await User.findOne({ phone });
    
    // If not found by phone, but email is provided, try by email (backward compatibility)
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (!user) {
      // Build user data - only include email if it has a valid value
      const userData = {
        name: driverName,
        phone,
        licensePlate,
        password: Math.random().toString(36).slice(-8) // Generate random password
      };
      
      // Only add email if it's not empty (avoid duplicate null key error)
      if (email && email.trim()) {
        userData.email = email.trim().toLowerCase();
      }
      
      user = await User.create(userData);
    } else {
      // Update email if it was missing and now provided
      if (!user.email && email) {
        user.email = email;
        await user.save();
      }
    }

    // Check if parking type is still available
    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType || !parkingType.isActive) {
      return res.status(400).json({ message: 'Loại bãi đậu xe không khả dụng' });
    }

    // Check for maintenance days that affect this specific parking type
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    
    // Validate minimum booking days
    const settings = await SystemSettings.getSettings();
    const minBookingDays = settings.minBookingDays || 1;
    
    // Calculate calendar days difference (inclusive)
    const checkInDateOnly = new Date(checkIn);
    checkInDateOnly.setHours(0, 0, 0, 0);
    const checkOutDateOnly = new Date(checkOut);
    checkOutDateOnly.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.ceil((checkOutDateOnly - checkInDateOnly) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < minBookingDays) {
      return res.status(400).json({ 
        message: `最少需預約 ${minBookingDays} 天，您選擇了 ${daysDiff} 天` 
      });
    }
    
    const maintenanceDays = await MaintenanceDay.getMaintenanceDaysForRange(checkIn, checkOut);
    const affectingMaintenanceDays = maintenanceDays.filter(md => 
      md.isActive && md.affectedParkingTypes.some(pt => pt._id.toString() === parkingType._id.toString())
    );
    
    if (affectingMaintenanceDays.length > 0) {
      return res.status(400).json({ 
        message: '此期間停車場正在維護',
        maintenanceDays: affectingMaintenanceDays.map(md => ({
          date: md.date,
          reason: md.reason,
          description: md.description
        }))
      });
    }

    // Check availability: same per-Taiwan-day logic as checkAvailability and Bookings calendar
    const matchQuery = {
      parkingType: parkingType._id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
      isDeleted: { $ne: true },
      checkInTime: { $lt: checkOut },
      checkOutTime: { $gt: checkIn }
    };
    const overlappingList = await Booking.find(matchQuery)
      .select('checkInTime checkOutTime vehicleCount')
      .lean();

    let dayStr = toTaiwanDateStr(checkIn);
    const endDayStr = toTaiwanDateStr(checkOut);
    let maxOccupied = 0;

    while (dayStr <= endDayStr) {
      const startOfDay = new Date(dayStr + 'T00:00:00.000+08:00');
      const endOfDay = new Date(dayStr + 'T23:59:59.999+08:00');

      const occupiedThisDay = overlappingList
        .filter(b => b.checkInTime < endOfDay && b.checkOutTime > startOfDay)
        .reduce((sum, b) => sum + (b.vehicleCount ?? 1), 0);

      maxOccupied = Math.max(maxOccupied, occupiedThisDay);
      dayStr = nextTaiwanDay(dayStr);
    }

    const actualAvailableSpaces = Math.max(0, parkingType.totalSpaces - maxOccupied);
    const requestedVehicles = Math.max(1, parseInt(vehicleCount) || 1);

    if (actualAvailableSpaces < requestedVehicles) {
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
      phone: user.phone,
      isVIP: user.isVIP,
      userEmail: user.email,
      phone: user.phone,
      luggageCount: departureLuggageCount,
      vehicleCount: requestedVehicles
    });

    // Create booking
    const booking = await Booking.create({
      user: user._id,
      parkingType: parkingTypeId,
      checkInTime,
      checkOutTime,
      driverName,
      phone,
      email: email || undefined,
      licensePlate,
      passengerCount: departurePassengerCount, // Legacy field
      vehicleCount: requestedVehicles,
      luggageCount: departureLuggageCount, // Legacy field
      departurePassengerCount,
      departureLuggageCount,
      returnPassengerCount,
      returnLuggageCount,
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
      message: '預約成功',
      booking: {
        ...populatedBooking.toObject(),
        bookingNumber: populatedBooking.bookingNumber
      }
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Create manual booking (for staff)
exports.createManualBooking = async (req, res) => {
  try {
    console.log('🔍 [createManualBooking] Request Body:', JSON.stringify(req.body, null, 2));

    const {
      parkingTypeId,
      checkInTime,
      checkOutTime,
      driverName,
      phone,
      email,
      licensePlate,
      passengerCount = 1,
      vehicleCount = 1,
      luggageCount = 0,
      departurePassengerCount = 1,
      departureLuggageCount = 0,
      returnPassengerCount = 1,
      returnLuggageCount = 0,
      addonServices = [],
      discountCode,
      estimatedArrivalTime,
      flightNumber,
      notes,
      paymentStatus = 'pending',
      paymentMethod = 'cash',
      status = 'confirmed',
      departureTerminal,
      returnTerminal,
      isVIP: isVIPPassed,
      vipDiscount: vipDiscountPassed = 12 // Default VIP discount percentage
    } = req.body;

    console.log(`🔍 [createManualBooking] Extracted vehicleCount: ${vehicleCount} (type: ${typeof vehicleCount})`);
    
    // Check if parking type is available
    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    if (!parkingType.isActive) {
      return res.status(400).json({ message: 'Bãi đậu xe này hiện không hoạt động' });
    }

    // Check availability
    // Calculate actual available spaces
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);

    const maintenanceDays = await MaintenanceDay.getMaintenanceDaysForRange(checkIn, checkOut);
    const affectingMaintenanceDays = maintenanceDays.filter(md => 
      md.isActive && md.affectedParkingTypes.some(pt => pt._id.toString() === parkingType._id.toString())
    );
    
    if (affectingMaintenanceDays.length > 0) {
      return res.status(400).json({ 
        message: '此期間停車場正在維護',
        maintenanceDays: affectingMaintenanceDays.map(md => ({
          date: md.date,
          reason: md.reason,
          description: md.description
        }))
      });
    }

    const overlappingBookings = await Booking.aggregate([
      {
        $match: {
          parkingType: parkingType._id,
          status: { $in: ['pending', 'confirmed', 'checked-in'] },
          isDeleted: { $ne: true },
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
        }
      },
      {
        $group: {
          _id: null,
          totalVehicles: { $sum: { $ifNull: ["$vehicleCount", 1] } }
        }
      }
    ]);

    const usedSpaces = overlappingBookings.length > 0 ? overlappingBookings[0].totalVehicles : 0;
    const actualAvailableSpaces = Math.max(0, parkingType.totalSpaces - usedSpaces);
    const requestedVehicles = Math.max(1, parseInt(vehicleCount) || 1);

    if (actualAvailableSpaces < requestedVehicles) {
      return res.status(400).json({ message: 'Bãi đậu xe đã hết chỗ trong thời gian này' });
    }

    // Find or create user
    let user = await User.findOne({ phone });
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (!user) {
        console.log('🔍 [createManualBooking] User not found, creating new temp user context or using dummy');
        // For manual booking, if user doesn't exist, we might need a dummy user or just proceed if we can?
        // Booking model requires 'user'.
        // We should create a user if not exists? 
        // Or if the admin just entered a phone number.
        // Let's create a user if it doesn't exist to satisfy foreign key.
        const password = phone.slice(-6) || '123456';
        const isNewVIP = isVIPPassed === true || isVIPPassed === 'true';
        
        // Build user data - only include email if it has a valid value
        const userData = {
            name: driverName,
            phone: phone,
            password: password,
            licensePlate: licensePlate,
            role: 'user',
            isVIP: isNewVIP,
            vipDiscount: isNewVIP ? (Number(vipDiscountPassed) || 12) : 0 // Set VIP discount when creating VIP user
        };
        
        // Only add email if it's not empty (avoid duplicate null key error)
        if (email && email.trim()) {
            userData.email = email.trim().toLowerCase();
        }
        
        user = await User.create(userData);
        console.log('🔍 [createManualBooking] Created new user:', user._id, 'isVIP:', isNewVIP, 'vipDiscount:', user.vipDiscount);
    } else {
        // Update existing user's VIP status if passed in request
        if (isVIPPassed === true || isVIPPassed === 'true') {
            if (!user.isVIP) {
                user.isVIP = true;
                user.vipDiscount = Number(vipDiscountPassed) || 12;
                await user.save();
                console.log('🔍 [createManualBooking] Updated existing user to VIP:', user._id, 'vipDiscount:', user.vipDiscount);
            }
        }
        console.log('🔍 [createManualBooking] Found user:', user._id, 'isVIP:', user.isVIP, 'vipDiscount:', user.vipDiscount);
    }

    // Calculate price
    console.log('🔍 [createManualBooking] Calculating price...');
    const priceCalculation = await calculateBookingPrice({
      parkingTypeId,
      checkInTime,
      checkOutTime,
      addonServices,
      discountCode,
      isVIP: user.isVIP,
      userEmail: user.email,
      phone: user.phone,
      luggageCount: departureLuggageCount,
      vehicleCount: requestedVehicles,
      vipDiscountPassed: user.vipDiscount || Number(vipDiscountPassed) || 12
    });
    
    console.log('🔍 [createManualBooking] Price calculation result:', priceCalculation.finalAmount);

    // Log pricing details
    console.log('🔍 [createManualBooking] Price Breakdown:', {
      base: priceCalculation.pricing?.basePrice,
      subtotal: priceCalculation.totalAmount,
      discount: priceCalculation.discountAmount,
      vip: priceCalculation.vipDiscount,
      final: priceCalculation.finalAmount,
      vehicles: requestedVehicles,
      days: priceCalculation.pricing?.durationDays
    });

    // Create booking
    console.log('🔍 [createManualBooking] Creating booking document...');
    const booking = await Booking.create({
      user: user._id,
      parkingType: parkingTypeId,
      checkInTime,
      checkOutTime,
      driverName,
      phone,
      email: email || undefined,
      licensePlate,
      passengerCount: departurePassengerCount, 
      vehicleCount: requestedVehicles,
      luggageCount: departureLuggageCount,
      departurePassengerCount,
      departureLuggageCount,
      returnPassengerCount,
      returnLuggageCount,
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
      status: status,
      paymentStatus: paymentStatus,
      paymentMethod: paymentMethod,
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

    // Manually construct response to ensure no fields are hidden
    const responseBooking = {
      _id: populatedBooking._id,
      bookingNumber: populatedBooking.bookingNumber,
      driverName: populatedBooking.driverName,
      phone: populatedBooking.phone,
      email: populatedBooking.email,
      licensePlate: populatedBooking.licensePlate,
      checkInTime: populatedBooking.checkInTime,
      checkOutTime: populatedBooking.checkOutTime,
      vehicleCount: populatedBooking.vehicleCount,
      passengerCount: populatedBooking.passengerCount,
      luggageCount: populatedBooking.luggageCount,
      departurePassengerCount: populatedBooking.departurePassengerCount,
      departureLuggageCount: populatedBooking.departureLuggageCount,
      returnPassengerCount: populatedBooking.returnPassengerCount,
      returnLuggageCount: populatedBooking.returnLuggageCount,
      status: populatedBooking.status,
      paymentStatus: populatedBooking.paymentStatus,
      paymentMethod: populatedBooking.paymentMethod,
      basePrice: priceCalculation.pricing?.basePrice || 0,
      totalAmount: populatedBooking.totalAmount,
      discountAmount: populatedBooking.discountAmount,
      vipDiscount: populatedBooking.vipDiscount,
      autoDiscount: populatedBooking.autoDiscount,
      finalAmount: populatedBooking.finalAmount,
      isVIP: populatedBooking.isVIP,
      parkingType: populatedBooking.parkingType,
      user: populatedBooking.user,
      addonServices: populatedBooking.addonServices,
      departureTerminal: populatedBooking.departureTerminal,
      returnTerminal: populatedBooking.returnTerminal,
      flightNumber: populatedBooking.flightNumber,
      notes: populatedBooking.notes,
      estimatedArrivalTime: populatedBooking.estimatedArrivalTime,
      createdAt: populatedBooking.createdAt,
      createdBy: populatedBooking.createdBy
    };

    console.log('🔍 [createManualBooking] Final Response Payload:', JSON.stringify(responseBooking, null, 2));

    res.status(201).json({
      message: '手動建立預約成功',
      booking: responseBooking
    });
  } catch (error) {
    console.error('🔍 [createManualBooking] Error:', error);
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
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
        message: '找不到預約' 
      });
    }

    if (booking.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: '無權取消此預約' 
      });
    }

    // Calculate refund amount
    const refundAmount = booking.totalAmount;

    // Update booking status
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelReason = reason || '由客戶取消';
    await booking.save();

    // Send cancellation notification
    try {
      const notificationResults = await notificationService.sendCancellationNotification(booking, booking.user, refundAmount);
      console.log('Cancellation notification results:', notificationResults);
    } catch (notificationError) {
      console.error('Error sending cancellation notification:', notificationError);
    }

    res.json({
      message: '取消預約成功',
      refundAmount,
      booking
    });
  } catch (error) {
    res.status(500).json({ 
      message: '伺服器錯誤', 
      error: error.message 
    });
  }
};

// Get booking by phone and license plate
exports.getBookingBySearch = async (req, res) => {
  try {
    const { phone, licensePlate } = req.query;

    if (!phone && !licensePlate) {
      return res.status(400).json({ message: '請輸入電話號碼或車牌號碼' });
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
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
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
      return res.status(404).json({ message: '找不到預約' });
    }

    res.json({ 
      booking: {
        ...booking.toObject(),
        bookingNumber: booking.bookingNumber
      }
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: '找不到預約' });
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
      message: '狀態更新成功',
      booking: {
        ...updatedBooking.toObject(),
        bookingNumber: updatedBooking.bookingNumber
      }
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
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
  phone = null,
  luggageCount = 0,
  vehicleCount = 1,
  vipDiscountPassed = 12 // Default VIP discount percentage
}) {
  const parkingType = await ParkingType.findById(parkingTypeId);
  if (!parkingType) {
    throw new Error('找不到停車類型');
  }

  const checkIn = new Date(checkInTime);
  const checkOut = new Date(checkOutTime);
  
  // Calculate pricing using new day-based logic
  const pricing = await parkingType.calculatePriceForRange(checkIn, checkOut);
  
  // Calculate total base price for all vehicles
  const count = Math.max(1, parseInt(vehicleCount) || 1);
  const totalBasePrice = pricing.totalPrice * count;

  // Calculate addon services
  let addonTotal = 0;
  const addonDetails = [];
  
  for (const addonId of addonServices) {
    const addon = await AddonService.findById(addonId);
    if (addon && addon.isActive) {
      // Addons charged per vehicle per user instruction
      const addonPrice = addon.price * count;
      addonTotal += addonPrice;
      addonDetails.push({
        service: addon._id,
        name: addon.name,
        price: addonPrice,
        icon: addon.icon
      });
    }
  }

  // Calculate luggage fees - DISABLED as per user request
  let luggageTotal = 0;
  let luggageDetails = null;
  
  // Logic removed: luggage is recorded but not charged
  // if (luggageCount > 0) { ... }

  // Calculate subtotal (base + addons + luggage)
  const subtotal = totalBasePrice + addonTotal; // luggageTotal is 0

  // Get user info for auto discount and VIP calculations
  // Get user info for auto discount and VIP calculations
  let user = null;
  if (phone) {
    user = await User.findOne({ phone });
  } else if (userEmail) {
    user = await User.findOne({ email: userEmail });
  }
  
  // Update VIP status based on found user only if user exists
  if (user) {
    isVIP = user.isVIP;
    console.log(`[calculateBookingPrice] Found user ${user.name}, isVIP=${isVIP}, discount=${user.vipDiscount}%`);
  } else {
    console.log(`[calculateBookingPrice] User not found, using passed isVIP=${isVIP}`);
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
  
  if (isVIP) {
    let vipDiscountPercent = 0;
    
    if (user) {
      // Use user's vipDiscount if user exists
      vipDiscountPercent = user.vipDiscount || 0;
      console.log(`[calculateBookingPrice] Using user's vipDiscount: ${vipDiscountPercent}%`);
    } else if (vipDiscountPassed > 0) {
      // Use passed vipDiscount if user doesn't exist (for new VIP customer)
      vipDiscountPercent = vipDiscountPassed;
      console.log(`[calculateBookingPrice] Using passed vipDiscount: ${vipDiscountPercent}%`);
    } else {
      // Default VIP discount
      vipDiscountPercent = 12;
      console.log(`[calculateBookingPrice] Using default vipDiscount: ${vipDiscountPercent}%`);
    }

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
      status: { $in: ['confirmed', 'checked-in', 'pending'] } // add pending for safety
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

    // Get overdue bookings (overdue to leave)
    const overdueBookings = await Booking.find({
      checkOutTime: { $lt: today },
      status: 'checked-in'
    })
    .populate('parkingType', 'name code')
    .populate('user', 'name phone')
    .sort({ checkOutTime: 1 });

    // Get expected not entered (overdue to arrive)
    const expectedNotEnteredBookings = await Booking.find({
      checkInTime: { $lt: today },
      status: { $in: ['pending', 'confirmed'] }
    })
    .populate('parkingType', 'name code')
    .populate('user', 'name phone')
    .sort({ checkInTime: 1 });

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
      expectedNotEnteredBookings: addBookingNumber(expectedNotEnteredBookings),
      summary: {
        totalCheckIns: checkInsToday.length,
        totalCheckOuts: checkOutsToday.length,
        totalOverdue: overdueBookings.length,
        totalExpectedNotEntered: expectedNotEnteredBookings.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Apply discount code
exports.applyDiscount = async (req, res) => {
  try {
    const { discountCode, parkingTypeId, checkInTime, checkOutTime, addonServices = [], isVIP = false } = req.body;
    
    if (!discountCode || !parkingTypeId || !checkInTime || !checkOutTime) {
      return res.status(400).json({ 
        success: false,
        message: '缺少必要資訊' 
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
        message: '折扣碼無效或已過期'
      });
    }

    // Check if code usage limit exceeded
    if (code.maxUsage && code.usageCount >= code.maxUsage) {
      return res.json({
        success: false,
        message: '折扣碼已達使用上限'
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
      phone: req.body.phone || null,
      luggageCount: req.body.luggageCount || 0,
      vehicleCount: req.body.vehicleCount || 1
    });

    if (pricing.discountAmount <= 0) {
      return res.json({
        success: false,
        message: '此折扣碼無法適用於本訂單'
      });
    }

    res.json({
      success: true,
      message: '折扣碼已成功套用',
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
      message: '伺服器錯誤', 
      error: error.message 
    });
  }
};

module.exports = exports; 