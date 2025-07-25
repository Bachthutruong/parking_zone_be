const Booking = require('../models/Booking');
const ParkingLot = require('../models/ParkingLot');
const AddonService = require('../models/AddonService');
const DiscountCode = require('../models/DiscountCode');
const SystemSettings = require('../models/SystemSettings');
const User = require('../models/User');
const Terms = require('../models/Terms');
const NotificationTemplate = require('../models/NotificationTemplate');

// Dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's bookings
    const todayBookings = await Booking.find({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Today's revenue
    const todayRevenue = todayBookings.reduce((sum, booking) => {
      return sum + (booking.finalAmount || 0);
    }, 0);

    // Total parking spaces and available spaces
    const parkingLots = await ParkingLot.find({ isActive: true });
    const totalSpaces = parkingLots.reduce((sum, lot) => sum + lot.totalSpaces, 0);
    const availableSpaces = parkingLots.reduce((sum, lot) => sum + lot.availableSpaces, 0);

    // Currently parked vehicles
    const parkedVehicles = await Booking.countDocuments({
      status: { $in: ['checked-in', 'confirmed'] }
    });

    // Vehicles leaving today
    const leavingToday = await Booking.countDocuments({
      checkOutTime: { $gte: today, $lt: tomorrow },
      status: { $in: ['checked-in', 'confirmed'] }
    });

    // Recent bookings
    const recentBookings = await Booking.find()
      .populate('parkingLot', 'name type')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      todayBookings: todayBookings.length,
      todayRevenue,
      totalSpaces,
      availableSpaces,
      parkedVehicles,
      leavingToday,
      recentBookings
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get all bookings with filters
exports.getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      dateFrom,
      dateTo,
      search,
      parkingLotId
    } = req.query;

    const query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    // Search filter
    if (search) {
      query.$or = [
        { driverName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { licensePlate: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Parking lot filter
    if (parkingLotId) {
      query.parkingLot = parkingLotId;
    }

    const skip = (page - 1) * limit;

    const bookings = await Booking.find(query)
      .populate('parkingLot', 'name type')
      .populate('addonServices.service', 'name icon price')
      .populate('user', 'name email isVIP')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      bookings,
      total,
      totalPages,
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get booking statistics
exports.getBookingStats = async (req, res) => {
  try {
    const { period = '7days' } = req.query;
    
    let startDate = new Date();
    switch (period) {
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    const bookings = await Booking.find({
      createdAt: { $gte: startDate }
    });

    // Group by status
    const statusStats = {};
    bookings.forEach(booking => {
      statusStats[booking.status] = (statusStats[booking.status] || 0) + 1;
    });

    // Group by date
    const dailyStats = {};
    bookings.forEach(booking => {
      const date = booking.createdAt.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          bookings: 0,
          revenue: 0
        };
      }
      dailyStats[date].bookings++;
      dailyStats[date].revenue += booking.finalAmount || 0;
    });

    // Calculate totals
    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.finalAmount || 0), 0);
    const averageRevenue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    res.json({
      period,
      totalBookings,
      totalRevenue,
      averageRevenue,
      statusStats,
      dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
        date,
        ...stats
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      isVIP
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) {
      query.role = role;
    }

    if (isVIP !== undefined) {
      query.isVIP = isVIP === 'true';
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      users,
      total,
      totalPages,
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update user VIP status
exports.updateUserVIP = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVIP, vipDiscount } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { isVIP, vipDiscount },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    res.json({
      message: 'Cập nhật VIP thành công',
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update user information
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    res.json({
      message: 'Cập nhật thông tin người dùng thành công',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        licensePlate: user.licensePlate,
        address: user.address,
        isVIP: user.isVIP,
        vipDiscount: user.vipDiscount,
        notes: user.notes
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role = 'user',
      licensePlate,
      address,
      isVIP = false,
      vipDiscount = 10,
      notes
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'Email hoặc số điện thoại đã tồn tại' 
      });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      phone,
      password: password || '123456', // Default password
      role,
      licensePlate,
      address,
      isVIP,
      vipDiscount,
      notes,
      isActive: true
    });

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'Tạo người dùng thành công',
      user: userResponse
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ 
        message: 'Không tìm thấy người dùng' 
      });
    }

    // Check if user is admin (prevent deleting admin)
    if (user.role === 'admin') {
      return res.status(403).json({ 
        message: 'Không thể xóa tài khoản admin' 
      });
    }

    // Check if user has active bookings
    const activeBookings = await Booking.find({
      user: id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa người dùng có đặt chỗ đang hoạt động' 
      });
    }

    // Delete user
    await User.findByIdAndDelete(id);

    res.json({ 
      message: 'Xóa người dùng thành công' 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Get system settings
exports.getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update system settings
exports.updateSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    
    // Update settings with request body
    Object.assign(settings, req.body);
    await settings.save();

    res.json({
      message: 'Cập nhật cài đặt thành công',
      settings
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get parking lot statistics
exports.getParkingLotStats = async (req, res) => {
  try {
    const parkingLots = await ParkingLot.find({ isActive: true });
    
    const stats = await Promise.all(parkingLots.map(async (lot) => {
      const bookings = await Booking.find({
        parkingLot: lot._id,
        status: { $in: ['confirmed', 'checked-in'] }
      });

      const occupancyRate = ((lot.totalSpaces - lot.availableSpaces) / lot.totalSpaces * 100).toFixed(2);
      
      return {
        _id: lot._id,
        name: lot.name,
        type: lot.type,
        totalSpaces: lot.totalSpaces,
        availableSpaces: lot.availableSpaces,
        occupancyRate: parseFloat(occupancyRate),
        currentBookings: bookings.length,
        basePrice: lot.basePrice,
        pricePerHour: lot.pricePerHour
      };
    }));

    res.json({ parkingLots: stats });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get current parking status
exports.getCurrentParkingStatus = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Currently parked vehicles
    const parkedVehicles = await Booking.find({
      status: { $in: ['checked-in', 'confirmed'] }
    }).populate('parkingLot', 'name type')
      .populate('user', 'name phone');

    // Vehicles arriving today
    const arrivingToday = await Booking.find({
      checkInTime: { $gte: today, $lt: tomorrow },
      status: { $in: ['pending', 'confirmed'] }
    }).populate('parkingLot', 'name type')
      .populate('user', 'name phone');

    // Vehicles leaving today
    const leavingToday = await Booking.find({
      checkOutTime: { $gte: today, $lt: tomorrow },
      status: { $in: ['checked-in', 'confirmed'] }
    }).populate('parkingLot', 'name type')
      .populate('user', 'name phone');

    res.json({
      parkedVehicles,
      arrivingToday,
      leavingToday
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy đặt chỗ' });
    }

    // Update booking status
    booking.status = status;
    
    // Update actual check-in/out times
    if (status === 'checked-in') {
      booking.actualCheckInTime = new Date();
    } else if (status === 'checked-out') {
      booking.actualCheckOutTime = new Date();
    }

    await booking.save();

    res.json({
      message: 'Cập nhật trạng thái đặt chỗ thành công',
      booking: {
        _id: booking._id,
        status: booking.status,
        actualCheckInTime: booking.actualCheckInTime,
        actualCheckOutTime: booking.actualCheckOutTime
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Create manual booking
exports.createManualBooking = async (req, res) => {
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
      notes,
      createdBy
    } = req.body;

    // Check if parking lot is available
    const parkingLot = await ParkingLot.findById(parkingLotId);
    if (!parkingLot || !parkingLot.isActive) {
      return res.status(400).json({ message: 'Bãi đậu xe không khả dụng' });
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
      parkingLotId,
      checkInTime,
      checkOutTime,
      addonServices,
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
      notes,
      totalAmount: priceCalculation.totalAmount,
      finalAmount: priceCalculation.finalAmount,
      isVIP: user.isVIP,
      vipDiscount: priceCalculation.vipDiscount,
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      isManualBooking: true,
      createdBy
    });

    // Update parking lot availability
    await ParkingLot.findByIdAndUpdate(parkingLotId, {
      $inc: { availableSpaces: -1 }
    });

    res.status(201).json({
      message: 'Tạo đặt chỗ thủ công thành công',
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

// Helper function to calculate booking price
async function calculateBookingPrice({
  parkingLotId,
  checkInTime,
  checkOutTime,
  addonServices = [],
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

  let vipDiscount = 0;
  if (isVIP) {
    const settings = await SystemSettings.getSettings();
    vipDiscount = (totalBasePrice + addonTotal) * (settings.defaultVIPDiscount / 100);
  }

  const totalAmount = totalBasePrice + addonTotal;
  const finalAmount = totalAmount - vipDiscount;

  return {
    basePrice,
    durationHours,
    totalBasePrice,
    addonTotal,
    addonDetails,
    totalAmount,
    vipDiscount,
    finalAmount
  };
}

// Get all parking lots
exports.getAllParkingLots = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, isActive } = req.query;
    
    const query = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [parkingLots, total] = await Promise.all([
      ParkingLot.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ParkingLot.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      parkingLots,
      total,
      page: parseInt(page),
      totalPages
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Create parking lot
exports.createParkingLot = async (req, res) => {
  try {
    const {
      name,
      type,
      totalSpaces,
      basePrice,
      pricePerHour,
      description,
      location,
      features,
      operatingHours,
      isActive = true
    } = req.body;

    // Check if parking lot with same name already exists
    const existingLot = await ParkingLot.findOne({ name });
    if (existingLot) {
      return res.status(400).json({ 
        message: 'Bãi đậu xe với tên này đã tồn tại' 
      });
    }

    // Create new parking lot
    const parkingLot = await ParkingLot.create({
      name,
      type,
      totalSpaces,
      availableSpaces: totalSpaces, // Initially all spaces are available
      basePrice,
      pricePerHour,
      description,
      location,
      features: features || [],
      operatingHours,
      isActive
    });

    res.status(201).json({
      message: 'Tạo bãi đậu xe thành công',
      parkingLot
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Update parking lot
exports.updateParkingLot = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if parking lot exists
    const parkingLot = await ParkingLot.findById(id);
    if (!parkingLot) {
      return res.status(404).json({ 
        message: 'Không tìm thấy bãi đậu xe' 
      });
    }

    // If updating total spaces, adjust available spaces accordingly
    if (updateData.totalSpaces && updateData.totalSpaces !== parkingLot.totalSpaces) {
      const usedSpaces = parkingLot.totalSpaces - parkingLot.availableSpaces;
      updateData.availableSpaces = Math.max(0, updateData.totalSpaces - usedSpaces);
    }

    // Update parking lot
    const updatedLot = await ParkingLot.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    );

    res.json({
      message: 'Cập nhật bãi đậu xe thành công',
      parkingLot: updatedLot
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Delete parking lot
exports.deleteParkingLot = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if parking lot exists
    const parkingLot = await ParkingLot.findById(id);
    if (!parkingLot) {
      return res.status(404).json({ 
        message: 'Không tìm thấy bãi đậu xe' 
      });
    }

    // Check if parking lot has active bookings
    const activeBookings = await Booking.find({
      parkingLot: id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa bãi đậu xe có đặt chỗ đang hoạt động' 
      });
    }

    // Delete parking lot
    await ParkingLot.findByIdAndDelete(id);

    res.json({ 
      message: 'Xóa bãi đậu xe thành công' 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Get all parking types
exports.getAllParkingTypes = async (req, res) => {
  try {
    const parkingTypes = await SystemSettings.findOne().select('parkingLotTypes');
    res.json({
      parkingTypes: parkingTypes?.parkingLotTypes || []
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Create parking type
exports.createParkingType = async (req, res) => {
  try {
    const { name, type, icon, description, basePrice, maxSpots, features, isActive } = req.body;

    const settings = await SystemSettings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Không tìm thấy cài đặt hệ thống' });
    }

    // Check if type already exists
    const existingType = settings.parkingLotTypes.find(pt => pt.type === type);
    if (existingType) {
      return res.status(400).json({ message: 'Loại bãi đậu xe đã tồn tại' });
    }

    const newType = {
      name,
      type,
      icon,
      description,
      basePrice,
      maxSpots,
      features: features || [],
      isActive: isActive !== false
    };

    settings.parkingLotTypes.push(newType);
    await settings.save();

    res.status(201).json({
      message: 'Tạo loại bãi đậu xe thành công',
      parkingType: newType
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Update parking type
exports.updateParkingType = async (req, res) => {
  try {
    const { type } = req.params;
    const updateData = req.body;

    const settings = await SystemSettings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Không tìm thấy cài đặt hệ thống' });
    }

    const typeIndex = settings.parkingLotTypes.findIndex(pt => pt.type === type);
    if (typeIndex === -1) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    settings.parkingLotTypes[typeIndex] = { ...settings.parkingLotTypes[typeIndex], ...updateData };
    await settings.save();

    res.json({
      message: 'Cập nhật loại bãi đậu xe thành công',
      parkingType: settings.parkingLotTypes[typeIndex]
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Delete parking type
exports.deleteParkingType = async (req, res) => {
  try {
    const { type } = req.params;

    const settings = await SystemSettings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Không tìm thấy cài đặt hệ thống' });
    }

    const typeIndex = settings.parkingLotTypes.findIndex(pt => pt.type === type);
    if (typeIndex === -1) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    // Check if parking type is being used
    const usedParkingLots = await ParkingLot.find({ type });
    if (usedParkingLots.length > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa loại bãi đậu xe đang được sử dụng' 
      });
    }

    settings.parkingLotTypes.splice(typeIndex, 1);
    await settings.save();

    res.json({ message: 'Xóa loại bãi đậu xe thành công' });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Get all addon services
exports.getAllAddonServices = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, isActive } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [services, total] = await Promise.all([
      AddonService.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AddonService.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      services,
      total,
      page: parseInt(page),
      totalPages
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Create addon service
exports.createAddonService = async (req, res) => {
  try {
    const {
      name,
      description,
      icon,
      price,
      category,
      duration,
      features,
      isActive = true
    } = req.body;

    // Check if service with same name already exists
    const existingService = await AddonService.findOne({ name });
    if (existingService) {
      return res.status(400).json({ 
        message: 'Dịch vụ với tên này đã tồn tại' 
      });
    }

    // Create new service
    const service = await AddonService.create({
      name,
      description,
      icon,
      price,
      category,
      duration,
      features: features || [],
      isActive
    });

    res.status(201).json({
      message: 'Tạo dịch vụ thành công',
      service
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Update addon service
exports.updateAddonService = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if service exists
    const service = await AddonService.findById(id);
    if (!service) {
      return res.status(404).json({ 
        message: 'Không tìm thấy dịch vụ' 
      });
    }

    // Update service
    const updatedService = await AddonService.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    );

    res.json({
      message: 'Cập nhật dịch vụ thành công',
      service: updatedService
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Delete addon service
exports.deleteAddonService = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if service exists
    const service = await AddonService.findById(id);
    if (!service) {
      return res.status(404).json({ 
        message: 'Không tìm thấy dịch vụ' 
      });
    }

    // Check if service is being used in bookings
    const usedBookings = await Booking.find({
      'addonServices.service': id
    });

    if (usedBookings.length > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa dịch vụ đang được sử dụng' 
      });
    }

    // Delete service
    await AddonService.findByIdAndDelete(id);

    res.json({ 
      message: 'Xóa dịch vụ thành công' 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Get all discount codes
exports.getAllDiscountCodes = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, isActive } = req.query;
    
    const query = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [discountCodes, total] = await Promise.all([
      DiscountCode.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DiscountCode.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      discountCodes,
      total,
      page: parseInt(page),
      totalPages
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Create discount code
exports.createDiscountCode = async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      maxUsage,
      validFrom,
      validTo,
      isActive = true
    } = req.body;

    // Check if code already exists
    const existingCode = await DiscountCode.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({ 
        message: 'Mã giảm giá đã tồn tại' 
      });
    }

    // Create new discount code
    const discountCode = await DiscountCode.create({
      code: code.toUpperCase(),
      name,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      maxUsage,
      currentUsage: 0,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      isActive
    });

    res.status(201).json({
      message: 'Tạo mã giảm giá thành công',
      discountCode
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Update discount code
exports.updateDiscountCode = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if discount code exists
    const discountCode = await DiscountCode.findById(id);
    if (!discountCode) {
      return res.status(404).json({ 
        message: 'Không tìm thấy mã giảm giá' 
      });
    }

    // Convert date strings to Date objects if provided
    if (updateData.validFrom) {
      updateData.validFrom = new Date(updateData.validFrom);
    }
    if (updateData.validTo) {
      updateData.validTo = new Date(updateData.validTo);
    }

    // Update discount code
    const updatedCode = await DiscountCode.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Cập nhật mã giảm giá thành công',
      discountCode: updatedCode
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Delete discount code
exports.deleteDiscountCode = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if discount code exists
    const discountCode = await DiscountCode.findById(id);
    if (!discountCode) {
      return res.status(404).json({ 
        message: 'Không tìm thấy mã giảm giá' 
      });
    }

    // Check if code is being used
    if (discountCode.usedCount > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa mã giảm giá đã được sử dụng' 
      });
    }

    // Delete discount code
    await DiscountCode.findByIdAndDelete(id);

    res.json({ 
      message: 'Xóa mã giảm giá thành công' 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// ===== TERMS CONTROLLERS =====

// Get all terms
exports.getAllTerms = async (req, res) => {
  try {
    const terms = await Terms.find().sort({ section: 1 });
    
    // Convert to object format for frontend
    const termsObject = {};
    terms.forEach(term => {
      termsObject[term.section] = {
        content: term.content,
        isActive: term.isActive
      };
    });
    
    res.json({ terms: termsObject });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Update terms section
exports.updateTermsSection = async (req, res) => {
  try {
    const { section } = req.params;
    const { content, isActive } = req.body;
    
    const terms = await Terms.findOneAndUpdate(
      { section },
      { 
        content, 
        isActive,
        lastUpdatedBy: req.user._id
      },
      { 
        new: true, 
        upsert: true,
        runValidators: true 
      }
    );
    
    res.json({
      message: 'Cập nhật điều khoản thành công',
      terms: {
        content: terms.content,
        isActive: terms.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Save all terms
exports.saveAllTerms = async (req, res) => {
  try {
    const termsData = req.body;
    const updates = [];
    
    for (const [section, data] of Object.entries(termsData)) {
      const update = Terms.findOneAndUpdate(
        { section },
        { 
          content: data.content, 
          isActive: data.isActive,
          lastUpdatedBy: req.user._id
        },
        { 
          new: true, 
          upsert: true,
          runValidators: true 
        }
      );
      updates.push(update);
    }
    
    await Promise.all(updates);
    
    res.json({
      message: 'Lưu tất cả điều khoản thành công'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// ===== NOTIFICATION TEMPLATE CONTROLLERS =====

// Get all notification templates
exports.getAllNotificationTemplates = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, search } = req.query;
    
    const query = {};
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const templates = await NotificationTemplate.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await NotificationTemplate.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      templates,
      total,
      totalPages,
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Create notification template
exports.createNotificationTemplate = async (req, res) => {
  try {
    const {
      name,
      type,
      subject,
      content,
      description,
      variables = [],
      isActive = true
    } = req.body;
    
    // Check if template with same name exists
    const existingTemplate = await NotificationTemplate.findOne({ name });
    if (existingTemplate) {
      return res.status(400).json({ 
        message: 'Mẫu thông báo với tên này đã tồn tại' 
      });
    }
    
    // Extract variables from content
    const extractedVariables = content.match(/\{\{(\w+)\}\}/g)?.map(v => v.slice(2, -2)) || [];
    const finalVariables = [...new Set([...variables, ...extractedVariables])];
    
    const template = await NotificationTemplate.create({
      name,
      type,
      subject,
      content,
      description,
      variables: finalVariables,
      isActive,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id
    });
    
    res.status(201).json({
      message: 'Tạo mẫu thông báo thành công',
      template
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Update notification template
exports.updateNotificationTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      subject,
      content,
      description,
      variables = [],
      isActive
    } = req.body;
    
    // Check if template exists
    const existingTemplate = await NotificationTemplate.findById(id);
    if (!existingTemplate) {
      return res.status(404).json({ 
        message: 'Không tìm thấy mẫu thông báo' 
      });
    }
    
    // Check if name is changed and conflicts with another template
    if (name !== existingTemplate.name) {
      const nameConflict = await NotificationTemplate.findOne({ name, _id: { $ne: id } });
      if (nameConflict) {
        return res.status(400).json({ 
          message: 'Mẫu thông báo với tên này đã tồn tại' 
        });
      }
    }
    
    // Extract variables from content
    const extractedVariables = content.match(/\{\{(\w+)\}\}/g)?.map(v => v.slice(2, -2)) || [];
    const finalVariables = [...new Set([...variables, ...extractedVariables])];
    
    const template = await NotificationTemplate.findByIdAndUpdate(
      id,
      {
        name,
        type,
        subject,
        content,
        description,
        variables: finalVariables,
        isActive,
        lastUpdatedBy: req.user._id
      },
      { new: true, runValidators: true }
    );
    
    res.json({
      message: 'Cập nhật mẫu thông báo thành công',
      template
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Delete notification template
exports.deleteNotificationTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if template exists
    const template = await NotificationTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ 
        message: 'Không tìm thấy mẫu thông báo' 
      });
    }
    
    // Check if template is being used (you can add this logic later)
    // const isUsed = await checkTemplateUsage(id);
    // if (isUsed) {
    //   return res.status(400).json({ 
    //     message: 'Không thể xóa mẫu thông báo đang được sử dụng' 
    //   });
    // }
    
    await NotificationTemplate.findByIdAndDelete(id);
    
    res.json({
      message: 'Xóa mẫu thông báo thành công'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

module.exports = exports; 