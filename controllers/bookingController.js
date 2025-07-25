const Booking = require('../models/Booking');
const ParkingLot = require('../models/ParkingLot');
const AddonService = require('../models/AddonService');
const DiscountCode = require('../models/DiscountCode');
const SystemSettings = require('../models/SystemSettings');
const User = require('../models/User');

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

// Check availability for specific parking lot and time
exports.checkAvailability = async (req, res) => {
  try {
    const { parkingLotId, checkInTime, checkOutTime } = req.body;
    
    if (!parkingLotId || !checkInTime || !checkOutTime) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    const parkingLot = await ParkingLot.findById(parkingLotId);
    if (!parkingLot || !parkingLot.isActive) {
      return res.status(404).json({ message: 'Không tìm thấy bãi đậu xe' });
    }

    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const durationHours = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60));

    // Check availability
    const isAvailable = await parkingLot.isAvailableForTime(checkIn, checkOut);
    
    if (!isAvailable) {
      return res.json({
        success: false,
        message: 'Bãi đậu xe đã hết chỗ trong thời gian này',
        availableSlots: [],
        pricing: null
      });
    }

    // Calculate pricing
    const basePrice = parkingLot.getPriceForDate(checkIn);
    const totalPrice = basePrice * durationHours;

    res.json({
      success: true,
      availableSlots: [{
        parkingLotId: parkingLot._id,
        name: parkingLot.name,
        type: parkingLot.type,
        availableSpaces: parkingLot.availableSpaces
      }],
      pricing: {
        basePrice,
        durationHours,
        totalPrice
      }
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get available parking lots by type
exports.getAvailableParkingLots = async (req, res) => {
  try {
    const { type, checkInTime, checkOutTime } = req.query;
    
    if (!type || !checkInTime || !checkOutTime) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);

    // Get parking lots of the specified type
    const parkingLots = await ParkingLot.find({ 
      type, 
      isActive: true 
    });

    // Check availability for each parking lot
    const availableLots = [];
    for (const lot of parkingLots) {
      const isAvailable = await lot.isAvailableForTime(checkIn, checkOut);
      if (isAvailable) {
        const price = lot.getPriceForDate(checkIn);
        availableLots.push({
          _id: lot._id,
          name: lot.name,
          type: lot.type,
          totalSpaces: lot.totalSpaces,
          availableSpaces: lot.availableSpaces,
          basePrice: lot.basePrice,
          pricePerHour: lot.pricePerHour,
          price: price,
          description: lot.description,
          features: lot.features
        });
      }
    }

    res.json({ parkingLots: availableLots });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Calculate booking price
exports.calculatePrice = async (req, res) => {
  try {
    const { 
      parkingLotId, 
      checkInTime, 
      checkOutTime, 
      addonServices = [],
      discountCode = null,
      isVIP = false 
    } = req.body;

    if (!parkingLotId || !checkInTime || !checkOutTime) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    const parkingLot = await ParkingLot.findById(parkingLotId);
    if (!parkingLot) {
      return res.status(404).json({ message: 'Không tìm thấy bãi đậu xe' });
    }

    // Calculate duration in hours
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const durationHours = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60));

    // Calculate base price
    const basePrice = parkingLot.getPriceForDate(checkIn);
    const totalBasePrice = basePrice * durationHours;

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

    // Calculate discount
    let discountAmount = 0;
    let discountType = null;
    let discountCodeInfo = null;

    if (discountCode) {
      const code = await DiscountCode.findOne({ 
        code: discountCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validTo: { $gte: new Date() }
      });

      if (code) {
        if (code.discountType === 'percentage') {
          discountAmount = (totalBasePrice + addonTotal) * (code.discountValue / 100);
        } else {
          discountAmount = code.discountValue;
        }
        discountType = code.discountType;
        discountCodeInfo = {
          code: code.code,
          discountValue: code.discountValue,
          discountType: code.discountType
        };
      }
    }

    // Calculate VIP discount
    let vipDiscount = 0;
    if (isVIP) {
      const settings = await SystemSettings.getSettings();
      vipDiscount = (totalBasePrice + addonTotal - discountAmount) * (settings.defaultVIPDiscount / 100);
    }

    const totalAmount = totalBasePrice + addonTotal;
    const finalDiscount = discountAmount + vipDiscount;
    const finalAmount = totalAmount - finalDiscount;

    res.json({
      basePrice,
      durationHours,
      totalBasePrice,
      addonTotal,
      addonDetails,
      totalAmount,
      discountAmount,
      vipDiscount,
      finalDiscount,
      finalAmount,
      discountCodeInfo,
      currency: 'TWD'
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Create booking
exports.createBooking = async (req, res) => {
  try {
    const {
      parkingLotId,
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
      termsAccepted
    } = req.body;

    // Validate required fields
    if (!termsAccepted) {
      return res.status(400).json({ message: 'Bạn phải đồng ý với các điều khoản' });
    }

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

    // Check if parking lot is still available
    const parkingLot = await ParkingLot.findById(parkingLotId);
    if (!parkingLot || !parkingLot.isActive) {
      return res.status(400).json({ message: 'Bãi đậu xe không khả dụng' });
    }

    const isAvailable = await parkingLot.isAvailableForTime(new Date(checkInTime), new Date(checkOutTime));
    if (!isAvailable) {
      return res.status(400).json({ message: 'Bãi đậu xe đã hết chỗ trong thời gian này' });
    }

    // Calculate price
    const priceCalculation = await calculateBookingPrice({
      parkingLotId,
      checkInTime,
      checkOutTime,
      addonServices,
      discountCode,
      isVIP: user.isVIP
    });

    // Create booking
    const booking = await Booking.create({
      user: user._id,
      parkingLot: parkingLotId,
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
      estimatedArrivalTime,
      flightNumber,
      notes,
      totalAmount: priceCalculation.totalAmount,
      discountAmount: priceCalculation.discountAmount,
      finalAmount: priceCalculation.finalAmount,
      isVIP: user.isVIP,
      vipDiscount: priceCalculation.vipDiscount,
      paymentStatus: 'pending',
      paymentMethod: 'cash'
    });

    // Update parking lot availability
    await ParkingLot.findByIdAndUpdate(parkingLotId, {
      $inc: { availableSpaces: -1 }
    });

    res.status(201).json({
      message: 'Đặt chỗ thành công',
      booking: {
        _id: booking._id,
        bookingNumber: `BK${booking._id.toString().slice(-6).toUpperCase()}`,
        status: booking.status,
        finalAmount: booking.finalAmount
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
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
      .populate('parkingLot', 'name type')
      .populate('addonServices.service', 'name icon price')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get booking details
exports.getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('parkingLot', 'name type description location')
      .populate('addonServices.service', 'name icon price description')
      .populate('user', 'name email phone isVIP');

    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy đặt chỗ' });
    }

    res.json({ booking });
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
    ).populate('parkingLot', 'name type');

    res.json({
      message: 'Cập nhật trạng thái thành công',
      booking: updatedBooking
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Helper function to calculate booking price
async function calculateBookingPrice({
  parkingLotId,
  checkInTime,
  checkOutTime,
  addonServices = [],
  discountCode = null,
  isVIP = false
}) {
  const parkingLot = await ParkingLot.findById(parkingLotId);
  const checkIn = new Date(checkInTime);
  const checkOut = new Date(checkOutTime);
  const durationHours = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60));

  const basePrice = parkingLot.getPriceForDate(checkIn);
  const totalBasePrice = basePrice * durationHours;

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

  let discountAmount = 0;
  let discountCodeInfo = null;

  if (discountCode) {
    const code = await DiscountCode.findOne({ 
      code: discountCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() }
    });

    if (code) {
      if (code.discountType === 'percentage') {
        discountAmount = (totalBasePrice + addonTotal) * (code.discountValue / 100);
      } else {
        discountAmount = code.discountValue;
      }
      discountCodeInfo = {
        code: code.code,
        discountValue: code.discountValue,
        discountType: code.discountType
      };
    }
  }

  let vipDiscount = 0;
  if (isVIP) {
    const settings = await SystemSettings.getSettings();
    vipDiscount = (totalBasePrice + addonTotal - discountAmount) * (settings.defaultVIPDiscount / 100);
  }

  const totalAmount = totalBasePrice + addonTotal;
  const finalDiscount = discountAmount + vipDiscount;
  const finalAmount = totalAmount - finalDiscount;

  return {
    basePrice,
    durationHours,
    totalBasePrice,
    addonTotal,
    addonDetails,
    totalAmount,
    discountAmount,
    vipDiscount,
    finalDiscount,
    finalAmount,
    discountCodeInfo
  };
}

module.exports = exports; 