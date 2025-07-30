const Booking = require('../models/Booking');
const ParkingType = require('../models/ParkingType');
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
    const parkingTypes = await ParkingType.find({ isActive: true });
    const totalSpaces = parkingTypes.reduce((sum, type) => sum + type.totalSpaces, 0);
    const availableSpaces = parkingTypes.reduce((sum, type) => sum + type.availableSpaces, 0);

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
      .populate('parkingType', 'name type')
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
      parkingTypeId
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

    // Parking type filter
    if (parkingTypeId) {
      query.parkingType = parkingTypeId;
    }

    const skip = (page - 1) * limit;

    const bookings = await Booking.find(query)
      .populate('parkingType', 'name type')
      .populate('addonServices.service', 'name icon price')
      .populate('user', 'name email isVIP')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Add bookingNumber to each booking
    const bookingsWithNumber = bookings.map(booking => ({
      ...booking.toObject(),
      bookingNumber: booking.bookingNumber
    }));

    const total = await Booking.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      bookings: bookingsWithNumber,
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
      isVIP,
      email
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (email) {
      query.email = email;
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

// Get user statistics with real booking data
exports.getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Get all bookings for this user
    const bookings = await Booking.find({ user: userId })
      .populate('parkingType', 'name type')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const totalBookings = bookings.length;
    const totalSpent = bookings.reduce((sum, booking) => sum + booking.finalAmount, 0);
    const averageSpent = totalBookings > 0 ? totalSpent / totalBookings : 0;
    
    // Get last booking date
    const lastBooking = bookings.length > 0 ? bookings[0].createdAt : null;
    
    // Calculate booking trend (compare last 30 days vs previous 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const recentBookings = bookings.filter(b => b.createdAt >= thirtyDaysAgo);
    const previousBookings = bookings.filter(b => 
      b.createdAt >= sixtyDaysAgo && b.createdAt < thirtyDaysAgo
    );
    
    let bookingTrend = 'stable';
    if (recentBookings.length > previousBookings.length) {
      bookingTrend = 'up';
    } else if (recentBookings.length < previousBookings.length) {
      bookingTrend = 'down';
    }

    // Get recent bookings (last 5)
    const recentBookingsList = bookings.slice(0, 5);

    // Calculate additional stats
    const completedBookings = bookings.filter(b => b.status === 'checked-out').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;

    // Calculate average duration
    const completedBookingsWithDuration = bookings.filter(b => b.status === 'checked-out');
    const totalDuration = completedBookingsWithDuration.reduce((sum, booking) => {
      const duration = new Date(booking.actualCheckOutTime || booking.checkOutTime) - 
                      new Date(booking.actualCheckInTime || booking.checkInTime);
      return sum + duration;
    }, 0);
    const averageDuration = completedBookingsWithDuration.length > 0 
      ? totalDuration / completedBookingsWithDuration.length / (1000 * 60 * 60 * 24) // Convert to days
      : 0;

    // Calculate VIP savings
    const vipBookings = bookings.filter(b => b.isVIP);
    const totalVipSavings = vipBookings.reduce((sum, booking) => sum + booking.discountAmount, 0);

    const stats = {
      totalBookings,
      totalSpent,
      averageSpent,
      lastBooking,
      bookingTrend,
      recentBookings: recentBookingsList,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      confirmedBookings,
      averageDuration: Math.round(averageDuration * 100) / 100, // Round to 2 decimal places
      totalVipSavings,
      vipBookingsCount: vipBookings.length
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update user VIP status
exports.updateUserVIP = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVIP, vipDiscount } = req.body;

    console.log('🔍 Backend VIP Update:', { id, isVIP, vipDiscount, body: req.body });

    // Validate input
    if (typeof isVIP !== 'boolean') {
      return res.status(400).json({ message: 'isVIP phải là boolean' });
    }

    if (isVIP && (vipDiscount === undefined || vipDiscount < 0 || vipDiscount > 100)) {
      return res.status(400).json({ message: 'vipDiscount phải từ 0 đến 100 khi isVIP là true' });
    }

    // Get user first to check current status
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Prepare update data
    const updateData = { isVIP };
    
    // Only include vipDiscount if it's provided and user is VIP
    if (isVIP && vipDiscount !== undefined) {
      updateData.vipDiscount = vipDiscount;
    } else if (!isVIP) {
      // Reset vipDiscount to 0 when removing VIP status
      updateData.vipDiscount = 0;
    }

    // Generate VIP code if becoming VIP and doesn't have one
    if (isVIP && !user.vipCode) {
      updateData.vipCode = user.generateVIPCode();
      updateData.vipCreatedAt = new Date();
    } else if (!isVIP) {
      // Remove VIP code when removing VIP status
      updateData.vipCode = null;
      updateData.vipCreatedAt = null;
    }

    console.log('🔍 Update Data:', updateData);

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    console.log('🔍 Updated User:', updatedUser);

    res.json({
      message: 'Cập nhật VIP thành công',
      user: updatedUser
    });
  } catch (error) {
    console.error('🔍 VIP Update Error:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update user information
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Get user first to check current status
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Handle VIP code generation if VIP status is being set
    if (updateData.isVIP && !existingUser.vipCode) {
      updateData.vipCode = existingUser.generateVIPCode();
      updateData.vipCreatedAt = new Date();
    } else if (updateData.isVIP === false) {
      // Remove VIP code when removing VIP status
      updateData.vipCode = null;
      updateData.vipCreatedAt = null;
    }

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

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
        vipCode: user.vipCode,
        vipCreatedAt: user.vipCreatedAt,
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

    // Prepare user data
    const userData = {
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
    };

    // Generate VIP code if user is VIP
    if (isVIP) {
      const tempUser = new User(userData);
      userData.vipCode = tempUser.generateVIPCode();
      userData.vipCreatedAt = new Date();
    }

    // Create new user
    const user = await User.create(userData);

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

// Get parking type statistics
exports.getParkingTypeStats = async (req, res) => {
  try {
    const parkingTypes = await ParkingType.find({ isActive: true });
    
    const stats = await Promise.all(parkingTypes.map(async (type) => {
      const bookings = await Booking.find({
        parkingType: type._id,
        status: { $in: ['confirmed', 'checked-in'] }
      });

      const occupancyRate = ((type.totalSpaces - type.availableSpaces) / type.totalSpaces * 100).toFixed(2);
      
      return {
        _id: type._id,
        name: type.name,
        type: type.type,
        totalSpaces: type.totalSpaces,
        availableSpaces: type.availableSpaces,
        occupancyRate: parseFloat(occupancyRate),
        currentBookings: bookings.length,
        pricePerDay: type.pricePerDay
      };
    }));

    res.json({ parkingTypes: stats });
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
    }).populate('parkingType', 'name type')
      .populate('user', 'name phone');

    // Vehicles arriving today
    const arrivingToday = await Booking.find({
      checkInTime: { $gte: today, $lt: tomorrow },
      status: { $in: ['pending'] }
    }).populate('parkingType', 'name type')
      .populate('user', 'name phone');

    // Vehicles leaving today
    const leavingToday = await Booking.find({
      checkOutTime: { $gte: today, $lt: tomorrow },
      status: { $in: ['checked-in'] }
    }).populate('parkingType', 'name type')
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

    // Prevent status changes for completed bookings
    if (booking.status === 'checked-out' || booking.status === 'cancelled') {
      return res.status(400).json({ 
        message: 'Không thể thay đổi trạng thái của đặt chỗ đã hoàn thành hoặc đã hủy' 
      });
    }

    // Validate status transitions
    const validTransitions = {
      'pending': ['checked-in', 'cancelled'],
      'confirmed': ['checked-in', 'cancelled'],
      'checked-in': ['checked-out']
    };

    const currentStatus = booking.status;
    const allowedTransitions = validTransitions[currentStatus] || [];
    
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({ 
        message: `Không thể chuyển từ trạng thái "${currentStatus}" sang "${status}"` 
      });
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
        actualCheckOutTime: booking.actualCheckOutTime,
        bookingNumber: booking.bookingNumber
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
      notes,
      createdBy
    } = req.body;

    // Check if parking type is available
    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType || !parkingType.isActive) {
      return res.status(400).json({ message: 'Loại bãi đậu xe không khả dụng' });
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
      isVIP: user.isVIP,
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
      notes,
      totalAmount: priceCalculation.totalAmount,
      finalAmount: priceCalculation.finalAmount,
      isVIP: user.isVIP,
      vipDiscount: priceCalculation.vipDiscount,
      status: 'pending',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      isManualBooking: true,
      createdBy
    });

    // Update parking type availability
    await ParkingType.findByIdAndUpdate(parkingTypeId, {
      $inc: { availableSpaces: -1 }
    });

    res.status(201).json({
      message: 'Tạo đặt chỗ thủ công thành công',
      booking: {
        _id: booking._id,
        bookingNumber: booking.bookingNumber,
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
  parkingTypeId,
  checkInTime,
  checkOutTime,
  addonServices = [],
  isVIP = false,
  luggageCount = 0
}) {
  const parkingType = await ParkingType.findById(parkingTypeId);
  const checkIn = new Date(checkInTime);
  const checkOut = new Date(checkOutTime);
  
  // Calculate pricing using new day-based logic
  const pricing = parkingType.calculatePriceForRange(checkIn, checkOut);
  const totalBasePrice = pricing.totalPrice;

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
  if (luggageCount > 0) {
    const settings = await SystemSettings.getSettings();
    const { freeLuggageCount, luggagePricePerItem } = settings.luggageSettings;
    
    const additionalLuggage = Math.max(0, luggageCount - freeLuggageCount);
    luggageTotal = additionalLuggage * luggagePricePerItem;
  }

  let vipDiscount = 0;
  if (isVIP) {
    const settings = await SystemSettings.getSettings();
    vipDiscount = (totalBasePrice + addonTotal + luggageTotal) * (settings.defaultVIPDiscount / 100);
  }

  const totalAmount = totalBasePrice + addonTotal + luggageTotal;
  const finalAmount = totalAmount - vipDiscount;

  return {
    pricePerDay: parkingType.pricePerDay,
    durationDays: pricing.durationDays,
    totalBasePrice,
    addonTotal,
    addonDetails,
    luggageTotal,
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
    const parkingTypes = await ParkingType.find({});
    res.json({
      parkingTypes: parkingTypes
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
    const { name, code, type, icon, description, totalSpaces, pricePerDay, isActive, features } = req.body;

    // Check if code already exists
    const existingType = await ParkingType.findOne({ code });
    if (existingType) {
      return res.status(400).json({ message: 'Mã bãi đậu xe đã tồn tại' });
    }

    const newType = await ParkingType.create({
      name,
      code,
      type: type || 'indoor',
      icon: icon || '🏢',
      description,
      totalSpaces: totalSpaces || 100,
      availableSpaces: totalSpaces || 100,
      pricePerDay: pricePerDay || 100,
      isActive: isActive !== false,
      features: features || []
    });

    res.status(201).json({
      message: 'Tạo bãi đậu xe thành công',
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

    // Try to find by _id first, then by code
    let parkingType = await ParkingType.findById(type);
    if (!parkingType) {
      parkingType = await ParkingType.findOne({ code: type });
    }
    
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy bãi đậu xe' });
    }

    // If the current parking type doesn't have a code, don't require it in update
    if (!parkingType.code && !updateData.code) {
      delete updateData.code; // Remove code from update if it's not provided and current is null
    }

    Object.assign(parkingType, updateData);
    await parkingType.save();

    res.json({
      message: 'Cập nhật bãi đậu xe thành công',
      parkingType: parkingType
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

    const parkingType = await ParkingType.findOne({ code: type });
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy bãi đậu xe' });
    }

    // Check if parking type is being used
    const usedBookings = await Booking.find({ parkingType: parkingType._id });
    if (usedBookings.length > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa bãi đậu xe đang được sử dụng' 
      });
    }

    await ParkingType.findByIdAndDelete(parkingType._id);

    res.json({ message: 'Xóa bãi đậu xe thành công' });
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

// Test notification
exports.testNotification = async (req, res) => {
  try {
    const { templateName, type, recipient, variables } = req.body;
    
    if (!templateName || !type || !recipient) {
      return res.status(400).json({ 
        message: 'Thiếu thông tin bắt buộc' 
      });
    }

    const notificationService = require('../utils/notificationService');
    const result = await notificationService.testNotification(templateName, type, recipient, variables);
    
    if (result.success) {
      res.json({
        message: 'Gửi thông báo thành công',
        result
      });
    } else {
      res.status(400).json({
        message: 'Không thể gửi thông báo',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Send notification to multiple users
exports.sendBulkNotification = async (req, res) => {
  try {
    const { templateName, type, recipients, variables } = req.body;
    
    if (!templateName || !type || !recipients || !Array.isArray(recipients)) {
      return res.status(400).json({ 
        message: 'Thiếu thông tin bắt buộc' 
      });
    }

    const notificationService = require('../utils/notificationService');
    const results = [];

    for (const recipient of recipients) {
      const result = await notificationService.testNotification(templateName, type, recipient, variables);
      results.push({ recipient, ...result });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      message: `Gửi thông báo hoàn tất: ${successCount} thành công, ${failureCount} thất bại`,
      results
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Get notification statistics
exports.getNotificationStats = async (req, res) => {
  try {
    const stats = await NotificationTemplate.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: ['$isActive', 1, 0] }
          }
        }
      }
    ]);

    const totalTemplates = await NotificationTemplate.countDocuments();
    const activeTemplates = await NotificationTemplate.countDocuments({ isActive: true });

    res.json({
      stats,
      total: totalTemplates,
      active: activeTemplates,
      inactive: totalTemplates - activeTemplates
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
};

// Special pricing management
exports.addSpecialPrice = async (req, res) => {
  try {
    const { parkingTypeId } = req.params;
    const { startDate, endDate, price, reason, isActive, forceOverride = false } = req.body;
    
    if (!startDate || !endDate || !price || !reason || !reason.trim()) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc. Vui lòng nhập đầy đủ ngày, giá và lý do' });
    }

    // Validate date format and logic
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Định dạng ngày không hợp lệ' });
    }
    
    if (start > end) {
      return res.status(400).json({ message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu' });
    }
    
    if (start < new Date()) {
      return res.status(400).json({ message: 'Ngày bắt đầu không thể trong quá khứ' });
    }

    // Validate price
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      return res.status(400).json({ message: 'Giá phải là số dương' });
    }

    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    // Check if special price already exists for overlapping date range
    const existingSpecialPrice = parkingType.specialPrices.find(sp => 
      sp.isActive && 
      ((new Date(startDate) <= sp.endDate && new Date(endDate) >= sp.startDate))
    );

    if (existingSpecialPrice) {
      // Check if it's an exact match (same start and end date)
      const isExactMatch = new Date(startDate).getTime() === existingSpecialPrice.startDate.getTime() && 
                          new Date(endDate).getTime() === existingSpecialPrice.endDate.getTime();
      
      if (isExactMatch) {
        // Update existing special price
        existingSpecialPrice.price = parseFloat(price);
        existingSpecialPrice.reason = reason.trim();
        existingSpecialPrice.isActive = isActive !== false;
        
        await parkingType.save();
        
        return res.json({
          message: 'Cập nhật giá đặc biệt thành công',
          specialPrice: existingSpecialPrice
        });
      } else if (forceOverride) {
        // Remove overlapping special prices and add new one
        parkingType.specialPrices = parkingType.specialPrices.filter(sp => 
          !(sp.isActive && ((new Date(startDate) <= sp.endDate && new Date(endDate) >= sp.startDate)))
        );
        
        // Add new special price
        parkingType.specialPrices.push({
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          price: parseFloat(price),
          reason: reason.trim(),
          isActive: isActive !== false
        });
        
        await parkingType.save();
        
        return res.json({
          message: 'Thêm giá đặc biệt thành công (đã ghi đè)',
          specialPrice: parkingType.specialPrices[parkingType.specialPrices.length - 1]
        });
      } else {
        return res.status(400).json({ 
          message: 'Giá đặc biệt đã tồn tại cho khoảng thời gian này',
          existingSpecialPrice: {
            startDate: existingSpecialPrice.startDate,
            endDate: existingSpecialPrice.endDate,
            reason: existingSpecialPrice.reason
          }
        });
      }
    }

    // Add special price
    parkingType.specialPrices.push({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      price: parseFloat(price),
      reason: reason.trim(),
      isActive: isActive !== false
    });

    await parkingType.save();

    res.json({
      message: 'Thêm giá đặc biệt thành công',
      specialPrice: parkingType.specialPrices[parkingType.specialPrices.length - 1]
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Add multiple special prices (bulk)
exports.addBulkSpecialPrices = async (req, res) => {
  try {
    const { parkingTypeId } = req.params;
    const { specialPrices, forceOverride = false } = req.body;
    
    if (!Array.isArray(specialPrices) || specialPrices.length === 0) {
      return res.status(400).json({ message: 'Danh sách giá đặc biệt không hợp lệ' });
    }

    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const specialPriceData of specialPrices) {
      const { startDate, endDate, price, reason, isActive } = specialPriceData;
      
      try {
        // Validate required fields
        if (!startDate || !endDate || !price || !reason || !reason.trim()) {
          results.failed.push({
            ...specialPriceData,
            error: 'Thiếu thông tin bắt buộc. Vui lòng nhập đầy đủ ngày, giá và lý do'
          });
          continue;
        }

        // Validate date format and logic
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          results.failed.push({
            ...specialPriceData,
            error: 'Định dạng ngày không hợp lệ'
          });
          continue;
        }
        
        if (start > end) {
          results.failed.push({
            ...specialPriceData,
            error: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu'
          });
          continue;
        }
        
        if (start < new Date()) {
          results.failed.push({
            ...specialPriceData,
            error: 'Ngày bắt đầu không thể trong quá khứ'
          });
          continue;
        }

        // Validate price
        const priceValue = parseFloat(price);
        if (isNaN(priceValue) || priceValue <= 0) {
          results.failed.push({
            ...specialPriceData,
            error: 'Giá phải là số dương'
          });
          continue;
        }

        // Check if special price already exists for overlapping date range
        const existingSpecialPrice = parkingType.specialPrices.find(sp => 
          sp.isActive && 
          ((start <= sp.endDate && end >= sp.startDate))
        );

        if (existingSpecialPrice) {
          // If force override is enabled, remove existing special prices that overlap
          if (forceOverride) {
            // Remove all existing special prices that overlap with the new range
            parkingType.specialPrices = parkingType.specialPrices.filter(sp => 
              !(sp.isActive && ((start <= sp.endDate && end >= sp.startDate)))
            );
            
            results.success.push({
              ...specialPriceData,
              action: 'force_override',
              removedCount: 1
            });
          } else {
            // Check if we can merge or update the existing special price
            const existingStart = new Date(existingSpecialPrice.startDate);
            const existingEnd = new Date(existingSpecialPrice.endDate);
            
            // If new range completely contains existing range, update the existing one
            if (start <= existingStart && end >= existingEnd) {
              existingSpecialPrice.startDate = start;
              existingSpecialPrice.endDate = end;
              existingSpecialPrice.price = priceValue;
              existingSpecialPrice.reason = reason.trim();
              
              results.success.push({
                ...specialPriceData,
                action: 'updated',
                existingId: existingSpecialPrice._id
              });
              continue;
            }
            
            // If new range is completely within existing range, skip
            if (start >= existingStart && end <= existingEnd) {
              results.skipped.push({
                ...specialPriceData,
                error: 'Khoảng thời gian này đã được bao phủ bởi giá đặc biệt hiện có',
                existingSpecialPrice: {
                  startDate: existingSpecialPrice.startDate,
                  endDate: existingSpecialPrice.endDate,
                  reason: existingSpecialPrice.reason
                }
              });
              continue;
            }
            
            // If partial overlap, skip with detailed message
            results.skipped.push({
              ...specialPriceData,
              error: 'Giá đặc biệt đã tồn tại cho khoảng thời gian này',
              existingSpecialPrice: {
                startDate: existingSpecialPrice.startDate,
                endDate: existingSpecialPrice.endDate,
                reason: existingSpecialPrice.reason
              }
            });
            continue;
          }
        }

        // Add special price
        const newSpecialPrice = {
          startDate: start,
          endDate: end,
          price: priceValue,
          reason: reason.trim(),
          isActive: isActive !== false
        };

        parkingType.specialPrices.push(newSpecialPrice);
        results.success.push(newSpecialPrice);

      } catch (error) {
        results.failed.push({
          ...specialPriceData,
          error: error.message
        });
      }
    }

    // Save all changes at once
    if (results.success.length > 0) {
      await parkingType.save();
    }

    res.json({
      message: `Xử lý ${specialPrices.length} giá đặc biệt hoàn tất`,
      results: {
        total: specialPrices.length,
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        details: results
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update special price
exports.updateSpecialPrice = async (req, res) => {
  try {
    const { parkingTypeId, specialPriceId } = req.params;
    const { startDate, endDate, price, reason, isActive } = req.body;
    
    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    const specialPrice = parkingType.specialPrices.id(specialPriceId);
    if (!specialPrice) {
      return res.status(404).json({ message: 'Không tìm thấy giá đặc biệt' });
    }

    // Validate dates if both are provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Định dạng ngày không hợp lệ' });
      }
      
      if (start > end) {
        return res.status(400).json({ message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu' });
      }
    }
    
    if (startDate) specialPrice.startDate = new Date(startDate);
    if (endDate) specialPrice.endDate = new Date(endDate);
    if (price !== undefined) specialPrice.price = parseFloat(price);
    if (reason !== undefined) {
      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: 'Lý do không được để trống' });
      }
      specialPrice.reason = reason.trim();
    }
    if (isActive !== undefined) specialPrice.isActive = isActive;

    await parkingType.save();

    res.json({
      message: 'Cập nhật giá đặc biệt thành công',
      specialPrice
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Delete special price
exports.deleteSpecialPrice = async (req, res) => {
  try {
    const { parkingTypeId, specialPriceId } = req.params;
    
    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    parkingType.specialPrices = parkingType.specialPrices.filter(
      sp => sp._id.toString() !== specialPriceId
    );

    await parkingType.save();

    res.json({ message: 'Xóa giá đặc biệt thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get special prices for parking type
exports.getSpecialPrices = async (req, res) => {
  try {
    const { parkingTypeId } = req.params;
    
    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    res.json({
      specialPrices: parkingType.specialPrices.sort((a, b) => a.startDate - b.startDate)
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

module.exports = exports; 