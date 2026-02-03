const Booking = require('../models/Booking');
const ParkingType = require('../models/ParkingType');
const AddonService = require('../models/AddonService');
const DiscountCode = require('../models/DiscountCode');
const SystemSettings = require('../models/SystemSettings');
const User = require('../models/User');
const Terms = require('../models/Terms');
const NotificationTemplate = require('../models/NotificationTemplate');

const TAIWAN_TZ = 'Asia/Taipei';

/** Get YYYY-MM-DD in Taiwan for a Date (must match bookingController.checkAvailability) */
function toTaiwanDateStr(d) {
  return d.toLocaleDateString('en-CA', { timeZone: TAIWAN_TZ });
}

/** Next calendar day in Taiwan (YYYY-MM-DD) */
function nextTaiwanDay(dayStr) {
  const d = new Date(dayStr + 'T12:00:00+08:00');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: TAIWAN_TZ });
}

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
      parkingTypeId,
      sortBy = 'checkInTime',
      order = 'asc'
    } = req.query;

    const query = {};

    // Deleted filter
    const isDeletedParam = req.query.isDeleted;
    if (isDeletedParam === 'true') {
      query.isDeleted = true;
    } else {
      query.isDeleted = { $ne: true };
    }

    // Status filter (pending = 等待進入 = cả pending + confirmed)
    if (status) {
      if (status === 'pending') {
        query.status = { $in: ['pending', 'confirmed'] };
      } else {
        query.status = status;
      }
    }

    // Date range filter: lọc theo ngày Đài Loan (UTC+8), khớp với ngày hiển thị trên UI
    // Chỉ dateFrom: checkInTime rơi vào ngày dateFrom (theo giờ Đài Loan)
    // Chỉ dateTo: checkOutTime rơi vào ngày dateTo (theo giờ Đài Loan)
    // Cả dateFrom + dateTo: ngày bắt đầu đúng dateFrom và ngày kết thúc đúng dateTo (Đài Loan)
    const dateFromStart = dateFrom ? new Date(dateFrom + 'T00:00:00.000+08:00') : null;
    const dateFromEnd = dateFrom ? new Date(dateFrom + 'T23:59:59.999+08:00') : null;
    const dateToStart = dateTo ? new Date(dateTo + 'T00:00:00.000+08:00') : null;
    const dateToEnd = dateTo ? new Date(dateTo + 'T23:59:59.999+08:00') : null;
    if (dateFrom || dateTo) {
      if (dateFrom && dateTo) {
        query.checkInTime = { $gte: dateFromStart, $lte: dateFromEnd };
        query.checkOutTime = { $gte: dateToStart, $lte: dateToEnd };
      } else if (dateFrom) {
        query.checkInTime = { $gte: dateFromStart, $lte: dateFromEnd };
      } else {
        query.checkOutTime = { $gte: dateToStart, $lte: dateToEnd };
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
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const bookings = await Booking.find(query)
      .populate('parkingType')
      .populate('addonServices.service', 'name icon price')
      .populate('user', 'name email isVIP')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Add bookingNumber and dailyPrices to each booking
    const bookingsWithNumber = await Promise.all(bookings.map(async (booking) => {
      const bookingObj = booking.toObject();
      
      // Calculate daily prices if needed
      let dailyPrices = null;
      if (booking.parkingType && booking.checkInTime && booking.checkOutTime) {
        try {
          const pricing = await booking.parkingType.calculatePriceForRange(
            new Date(booking.checkInTime),
            new Date(booking.checkOutTime)
          );
          // Convert date objects to ISO strings
          dailyPrices = pricing.dailyPrices.map(dp => ({
            ...dp,
            date: dp.date.toISOString().split('T')[0] // Convert to YYYY-MM-DD format
          }));
        } catch (error) {
          console.error('Error calculating daily prices for booking:', booking._id, error);
        }
      }
      
      return {
        ...bookingObj,
        bookingNumber: booking.bookingNumber,
        dailyPrices: dailyPrices
      };
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

// Get all bookings for calendar view (no pagination)
exports.getCalendarBookings = async (req, res) => {
  try {
    const {
      status,
      dateFrom,
      dateTo,
      search,
      parkingTypeId,
      isDeleted
    } = req.query;

    const query = {};

    // Deleted filter
    if (isDeleted === 'true') {
      query.isDeleted = true;
    } else {
      query.isDeleted = { $ne: true };
    }

    // Status filter (pending = 等待進入 = cả pending + confirmed)
    if (status) {
      if (status === 'pending') {
        query.status = { $in: ['pending', 'confirmed'] };
      } else {
        query.status = status;
      }
    }

    // Date range filter for calendar - use checkInTime and checkOutTime for better accuracy
    if (dateFrom || dateTo) {
      // Find bookings that overlap with the date range
      const dateFilters = [];
      if (dateFrom && dateTo) {
        // Booking overlaps with date range
        dateFilters.push({
          checkInTime: { $lte: new Date(dateTo) },
          checkOutTime: { $gte: new Date(dateFrom) }
        });
      } else if (dateFrom) {
        dateFilters.push({ checkOutTime: { $gte: new Date(dateFrom) } });
      } else if (dateTo) {
        dateFilters.push({ checkInTime: { $lte: new Date(dateTo) } });
      }
      if (dateFilters.length > 0) {
        query.$and = dateFilters;
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

    // Get all bookings without pagination
    const bookings = await Booking.find(query)
      .populate('parkingType', '_id name code type icon color totalSpaces')
      .populate('user', 'name email isVIP')
      .sort({ checkInTime: 1 });

    // Return simplified data for calendar
    const calendarBookings = bookings.map(booking => ({
      _id: booking._id,
      bookingNumber: booking.bookingNumber,
      driverName: booking.driverName,
      phone: booking.phone,
      licensePlate: booking.licensePlate,
      email: booking.email,
      checkInTime: booking.checkInTime,
      checkOutTime: booking.checkOutTime,
      status: booking.status,
      parkingType: booking.parkingType,
      totalAmount: booking.totalAmount,
      finalAmount: booking.finalAmount,
      discountAmount: booking.discountAmount,
      autoDiscountAmount: booking.autoDiscountAmount,
      vipDiscount: booking.vipDiscount,
      departureTerminal: booking.departureTerminal,
      returnTerminal: booking.returnTerminal,
      departurePassengerCount: booking.departurePassengerCount,
      departureLuggageCount: booking.departureLuggageCount,
      returnPassengerCount: booking.returnPassengerCount,
      returnLuggageCount: booking.returnLuggageCount,
      passengerCount: booking.passengerCount,
      luggageCount: booking.luggageCount
    }));

    res.json({
      bookings: calendarBookings,
      total: calendarBookings.length
    });
  } catch (error) {
    console.error('Error loading calendar bookings:', error);
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

// Get all users with stats in one request (for admin users list)
function computeStatsFromBookings(bookings) {
  const totalBookings = bookings.length;
  const totalSpent = bookings.reduce((sum, b) => sum + (b.finalAmount || 0), 0);
  const averageSpent = totalBookings > 0 ? totalSpent / totalBookings : 0;
  const lastBooking = totalBookings > 0 ? bookings[0].createdAt : null;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const recentBookings = bookings.filter(b => b.createdAt >= thirtyDaysAgo);
  const previousBookings = bookings.filter(b => b.createdAt >= sixtyDaysAgo && b.createdAt < thirtyDaysAgo);
  let bookingTrend = 'stable';
  if (recentBookings.length > previousBookings.length) bookingTrend = 'up';
  else if (recentBookings.length < previousBookings.length) bookingTrend = 'down';
  const recentBookingsList = bookings.slice(0, 5);
  const completedBookings = bookings.filter(b => b.status === 'checked-out').length;
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const completedWithDuration = bookings.filter(b => b.status === 'checked-out');
  const totalDuration = completedWithDuration.reduce((sum, b) => {
    const duration = new Date(b.actualCheckOutTime || b.checkOutTime) - new Date(b.actualCheckInTime || b.checkInTime);
    return sum + duration;
  }, 0);
  const averageDuration = completedWithDuration.length > 0
    ? Math.round((totalDuration / completedWithDuration.length / (1000 * 60 * 60 * 24)) * 100) / 100
    : 0;
  const vipBookings = bookings.filter(b => b.isVIP);
  const totalVipSavings = vipBookings.reduce((sum, b) => sum + (b.discountAmount || 0), 0);
  return {
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
    averageDuration,
    totalVipSavings,
    vipBookingsCount: vipBookings.length
  };
}

exports.getAllUsersWithStats = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, role, isVIP, email, isActive } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (email) query.email = email;
    if (role) query.role = role;
    if (isVIP !== undefined && isVIP !== '') query.isVIP = isVIP === 'true';
    if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';

    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 500);
    const total = await User.countDocuments(query);
    const totalPagesCalc = total === 0 ? 1 : Math.ceil(total / limitNum);
    const pageNum = Math.max(1, Math.min(parseInt(page) || 1, totalPagesCalc));
    const skip = (pageNum - 1) * limitNum;
    const totalVip = query.isVIP === true ? total : (query.isVIP === false ? 0 : await User.countDocuments({ ...query, isVIP: true }));
    const totalActive = query.isActive === true ? total : (query.isActive === false ? 0 : await User.countDocuments({ ...query, isActive: true }));

    const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

    const totalPages = totalPagesCalc;
    const userIds = users.map(u => u._id);

    if (userIds.length === 0) {
      return res.json({
        users: users.map(u => ({ ...u, stats: computeStatsFromBookings([]) })),
        total,
        totalPages,
        currentPage: pageNum,
        totalVip,
        totalActive
      });
    }

    const allBookings = await Booking.find({ user: { $in: userIds } })
      .populate('parkingType', 'name type')
      .sort({ createdAt: -1 })
      .lean();

    const bookingsByUser = {};
    for (const b of allBookings) {
      const uid = (b.user && b.user._id ? b.user._id : b.user).toString();
      if (!bookingsByUser[uid]) bookingsByUser[uid] = [];
      bookingsByUser[uid].push(b);
    }

    const usersWithStats = users.map(u => {
      const uid = u._id.toString();
      const userBookings = bookingsByUser[uid] || [];
      const stats = computeStatsFromBookings(userBookings);
      return { ...u, stats };
    });

    res.json({
      users: usersWithStats,
      total,
      totalPages,
      currentPage: pageNum,
      totalVip,
      totalActive
    });
  } catch (error) {
    console.error('getAllUsersWithStats error:', error);
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

    // Update user fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        existingUser[key] = updateData[key];
      }
    });

    // Ensure password is marked as modified if it's being updated
    if (updateData.password) {
      existingUser.markModified('password');
    }

    // Save user to trigger pre-save middleware (for password hashing)
    const user = await existingUser.save();

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

    // Check if user has active bookings - DISABLED to allow deletion
    /*
    const activeBookings = await Booking.find({
      user: id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa người dùng có đặt chỗ đang hoạt động' 
      });
    }
    */

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

    const updateData = { ...req.body };

    // Handle luggageSettings separately to ensure nested imageUrl is preserved
    if (updateData.luggageSettings) {
      const currentLuggage = settings.luggageSettings || {};
      const currentContent = (currentLuggage.luggageContent && currentLuggage.luggageContent.toObject)
        ? currentLuggage.luggageContent.toObject()
        : currentLuggage.luggageContent || {};

      const incomingLuggage = updateData.luggageSettings;
      const incomingContent = incomingLuggage.luggageContent || {};

      const mergedLuggageContent = {
        ...currentContent,
        ...incomingContent
      };

      const mergedLuggageSettings = {
        ...currentLuggage.toObject?.() || currentLuggage,
        ...incomingLuggage,
        luggageContent: mergedLuggageContent
      };

      settings.luggageSettings = mergedLuggageSettings;
      settings.markModified('luggageSettings');

      // Remove from generic update so it doesn't get overwritten
      delete updateData.luggageSettings;
    }

    // Apply remaining top-level updates
    Object.assign(settings, updateData);

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

    // Validate status transitions - Relaxed for Admin to allow reverts
    // const validTransitions = {
    //   'pending': ['checked-in', 'cancelled', 'confirmed'],
    //   'confirmed': ['checked-in', 'cancelled', 'pending'],
    //   'checked-in': ['checked-out', 'confirmed'],
    //   'checked-out': ['checked-in'],
    //   'cancelled': ['confirmed', 'pending']
    // };

    const currentStatus = booking.status;
    // const allowedTransitions = validTransitions[currentStatus] || [];
    
    // if (!allowedTransitions.includes(status)) {
    //   return res.status(400).json({ 
    //     message: `Không thể chuyển từ trạng thái "${currentStatus}" sang "${status}"` 
    //   });
    // }

    // Update booking status
    booking.status = status;

    // Handle cancellation reason
    if (status === 'cancelled' && req.body.reason) {
        const timestamp = new Date().toLocaleString('vi-VN');
        const reasonNote = `\n[${timestamp}] Hủy đơn: ${req.body.reason}`;
        booking.notes = booking.notes ? booking.notes + reasonNote : reasonNote;
    }
    
    // Update actual check-in/out times
    if (status === 'checked-in') {
      booking.actualCheckInTime = new Date();
    } else if (status === 'checked-out') {
      booking.actualCheckOutTime = new Date();
    } else if (status === 'confirmed' || status === 'pending') {
        // Reset actual times if reverting
        if (currentStatus === 'checked-in') booking.actualCheckInTime = undefined;
        if (currentStatus === 'checked-out') booking.actualCheckOutTime = undefined;
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

// Update booking (full edit for admin)
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');
    const allowed = ['driverName', 'phone', 'email', 'licensePlate', 'checkInTime', 'checkOutTime', 'status', 'notes', 'parkingType'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'checkInTime' || key === 'checkOutTime') {
          updates[key] = new Date(req.body[key]);
        } else if (key === 'parkingType' && req.body[key]) {
          updates[key] = mongoose.Types.ObjectId.isValid(req.body[key]) ? new mongoose.Types.ObjectId(req.body[key]) : req.body[key];
        } else {
          updates[key] = req.body[key];
        }
      }
    }
    if (updates.status) {
      const validStatuses = ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'];
      if (!validStatuses.includes(updates.status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      }
    }
    const booking = await Booking.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('parkingType', 'name code type')
      .populate('user', 'name phone email');
    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy đặt chỗ' });
    }
    res.json({
      message: 'Cập nhật đặt chỗ thành công',
      booking
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Soft delete booking
exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy đặt chỗ' });
    }

    // If already deleted, return error or success?
    if (booking.isDeleted) {
      return res.status(400).json({ message: 'Đặt chỗ này đã bị xóa trước đó' });
    }

    booking.isDeleted = true;
    booking.deletedAt = new Date();
    booking.deletionReason = reason;
    // We might want to change status to cancelled if it impacts availability logic
    // But soft delete usually implies hiding.
    // However, if we delete a confirmed booking, we should probably release the space?
    // Let's release the space just in case, if not already released (e.g. checked-out/cancelled)
    if (['pending', 'confirmed', 'checked-in'].includes(booking.status)) {
       // Release space logic
       if (booking.parkingType) {
           await ParkingType.findByIdAndUpdate(booking.parkingType, {
               $inc: { availableSpaces: booking.vehicleCount || 1 } 
           });
       }
       // Update status to cancelled as well? Or keep original status? 
       // Generally if deleted, it shouldn't count.
       // Let's keep status as is for record, but isDeleted flag handles visibility.
       // But availability logic might rely on status.
       // My createManualBooking availability check looks at status: { $in: ['pending', 'confirmed', 'checked-in'] }
       // It does NOT check isDeleted.
       // So we MUST also change status to 'cancelled' OR update availability check.
       // Updating status to 'cancelled' is safer for existing logic.
       booking.status = 'cancelled';
    }

    await booking.save();

    res.json({
      message: 'Xóa đặt chỗ thành công',
      booking: {
        _id: booking._id,
        isDeleted: booking.isDeleted,
        deletedAt: booking.deletedAt
      }
    });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Create manual booking
exports.createManualBooking = async (req, res) => {
  try {
    console.log('🔍 [adminController.createManualBooking] Request Body:', JSON.stringify(req.body, null, 2));

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
      vipDiscount: vipDiscountPassed = 12
    } = req.body;

    console.log(`🔍 [adminController.createManualBooking] vehicleCount: ${vehicleCount}, isVIP: ${isVIPPassed}, vipDiscount: ${vipDiscountPassed}`);

    // Check if parking type is available
    const parkingType = await ParkingType.findById(parkingTypeId);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    if (!parkingType.isActive) {
      return res.status(400).json({ message: 'Bãi đậu xe này hiện không hoạt động' });
    }

    // Check availability: same per-Taiwan-day logic as bookingController.checkAvailability and Bookings.tsx calendar.
    // "Còn trống" = for each Taiwan calendar day in [checkIn, checkOut], occupied <= totalSpaces - requested; take max occupied over days.
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);

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

    // Find or create user
    let user = await User.findOne({ phone });
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (!user) {
      console.log('🔍 [adminController.createManualBooking] Creating new user...');
      const password = phone.slice(-6) || '123456';
      const isNewVIP = isVIPPassed === true || isVIPPassed === 'true';
      user = await User.create({
        name: driverName,
        phone: phone,
        email: email || undefined,
        password: password,
        licensePlate: licensePlate,
        role: 'user',
        isVIP: isNewVIP,
        vipDiscount: isNewVIP ? (Number(vipDiscountPassed) || 12) : 0
      });
      console.log('🔍 [adminController.createManualBooking] Created new user:', user._id, 'isVIP:', user.isVIP, 'vipDiscount:', user.vipDiscount);
    } else {
      // Update existing user's VIP status if passed in request
      if ((isVIPPassed === true || isVIPPassed === 'true') && !user.isVIP) {
        user.isVIP = true;
        user.vipDiscount = Number(vipDiscountPassed) || 12;
        await user.save();
        console.log('🔍 [adminController.createManualBooking] Updated existing user to VIP:', user._id);
      }
      console.log('🔍 [adminController.createManualBooking] Found user:', user._id, 'isVIP:', user.isVIP, 'vipDiscount:', user.vipDiscount);
    }

    // Calculate price using accurate logic
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

    console.log('🔍 [adminController.createManualBooking] Price calculation:', {
      basePrice: priceCalculation.pricing?.basePrice,
      totalAmount: priceCalculation.totalAmount,
      vipDiscount: priceCalculation.vipDiscount,
      finalAmount: priceCalculation.finalAmount,
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
      estimatedArrivalTime: estimatedArrivalTime || undefined,
      flightNumber: flightNumber || undefined,
      notes: notes || undefined,
      totalAmount: priceCalculation.totalAmount,
      discountAmount: priceCalculation.discountAmount,
      finalAmount: priceCalculation.finalAmount,
      isVIP: user.isVIP,
      vipDiscount: priceCalculation.vipDiscount,
      status: status,
      paymentStatus: paymentStatus,
      paymentMethod: paymentMethod,
      departureTerminal: departureTerminal || undefined,
      returnTerminal: returnTerminal || undefined,
      isManualBooking: true,
      createdBy: req.user?._id
    });

    // Update parking type availability
    await ParkingType.findByIdAndUpdate(parkingTypeId, {
      $inc: { availableSpaces: -requestedVehicles }
    });

    // Populate booking data for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate('parkingType', 'name type location pricePerDay')
      .populate('addonServices.service', 'name icon price')
      .populate('user', 'name email phone isVIP vipDiscount')
      .populate('createdBy', 'name email');

    // Construct complete response
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
      discountAmount: populatedBooking.discountAmount || 0,
      vipDiscount: populatedBooking.vipDiscount || 0,
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
      dailyPrices: priceCalculation.pricing?.dailyPrices || [],
      durationDays: priceCalculation.pricing?.durationDays || 0,
      createdAt: populatedBooking.createdAt,
      createdBy: populatedBooking.createdBy
    };

    console.log('🔍 [adminController.createManualBooking] Final response:', JSON.stringify(responseBooking, null, 2));

    res.status(201).json({
      message: 'Tạo đặt chỗ thủ công thành công',
      booking: responseBooking
    });
  } catch (error) {
    console.error('🔍 [adminController.createManualBooking] Error:', error);
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
  phone = null,
  luggageCount = 0,
  vehicleCount = 1,
  vipDiscountPassed = 12
}) {
  const parkingType = await ParkingType.findById(parkingTypeId);
  if (!parkingType) {
    throw new Error('Không tìm thấy loại bãi đậu xe');
  }

  const checkIn = new Date(checkInTime);
  const checkOut = new Date(checkOutTime);
  
  // Calculate pricing using day-based logic
  const pricing = await parkingType.calculatePriceForRange(checkIn, checkOut);
  
  // Multiply by vehicle count
  const count = Math.max(1, parseInt(vehicleCount) || 1);
  const totalBasePrice = pricing.totalPrice * count;

  // Calculate addon services
  let addonTotal = 0;
  const addonDetails = [];
  
  for (const addonId of addonServices) {
    const addon = await AddonService.findById(addonId);
    if (addon && addon.isActive) {
      // Addons charged per vehicle
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

  // Get user info for VIP calculations
  let user = null;
  if (phone) {
    user = await User.findOne({ phone });
  } else if (userEmail) {
    user = await User.findOne({ email: userEmail });
  }

  // Apply auto discounts first
  let autoDiscountAmount = 0;
  let autoDiscountInfo = null;
  
  const AutoDiscount = require('../models/AutoDiscount');
  const autoDiscounts = await AutoDiscount.find({
    isActive: true,
    applicableParkingTypes: parkingTypeId,
    validFrom: { $lte: new Date() },
    validTo: { $gte: new Date() }
  }).sort({ priority: -1 });

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
      break;
    }
  }

  // Apply discount code
  let discountAmount = 0;
  let discountCodeInfo = null;
  const DiscountCode = require('../models/DiscountCode');

  if (discountCode && (!autoDiscountInfo || autoDiscountInfo.applyToSpecialPrices)) {
    const code = await DiscountCode.findOne({ 
      code: discountCode.toUpperCase().trim(),
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

  // Calculate VIP discount
  let vipDiscount = 0;
  if (isVIP) {
    let vipDiscountPercent = 0;
    
    if (user) {
      vipDiscountPercent = user.vipDiscount || 0;
      console.log(`[adminController.calculateBookingPrice] Using user's vipDiscount: ${vipDiscountPercent}%`);
    } else if (vipDiscountPassed > 0) {
      vipDiscountPercent = vipDiscountPassed;
      console.log(`[adminController.calculateBookingPrice] Using passed vipDiscount: ${vipDiscountPercent}%`);
    } else {
      vipDiscountPercent = 12;
      console.log(`[adminController.calculateBookingPrice] Using default vipDiscount: ${vipDiscountPercent}%`);
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

  console.log(`[adminController.calculateBookingPrice] Result: base=${totalBasePrice}, addons=${addonTotal}, subtotal=${subtotal}, autoDiscount=${autoDiscountAmount}, codeDiscount=${discountAmount}, vipDiscount=${vipDiscount}, final=${finalAmount}`);

  return {
    totalAmount,
    autoDiscountAmount,
    discountAmount,
    vipDiscount,
    finalAmount,
    addonDetails,
    autoDiscountInfo,
    discountCodeInfo,
    pricing: {
      basePrice: totalBasePrice,
      addonTotal: addonTotal,
      subtotal: subtotal,
      durationDays: pricing.durationDays,
      daysToCharge: pricing.daysToCharge,
      dailyPrices: pricing.dailyPrices
    }
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

    // Handle totalSpaces and availableSpaces updates to prevent negative availableSpaces
    if (updateData.totalSpaces !== undefined || updateData.availableSpaces !== undefined) {
      const currentTotalSpaces = parkingType.totalSpaces;
      const currentAvailableSpaces = parkingType.availableSpaces;
      const usedSpaces = currentTotalSpaces - currentAvailableSpaces;
      
      const newTotalSpaces = updateData.totalSpaces !== undefined 
        ? Number(updateData.totalSpaces) 
        : currentTotalSpaces;
      
      // If totalSpaces is being updated, recalculate availableSpaces
      if (updateData.totalSpaces !== undefined) {
        // Calculate new available spaces based on used spaces
        // Ensure it's never negative
        updateData.availableSpaces = Math.max(0, newTotalSpaces - usedSpaces);
      } else if (updateData.availableSpaces !== undefined) {
        // If only availableSpaces is being updated, validate it
        const newAvailableSpaces = Number(updateData.availableSpaces);
        // Ensure availableSpaces is between 0 and totalSpaces
        updateData.availableSpaces = Math.max(0, Math.min(newAvailableSpaces, newTotalSpaces));
      }
      
      // Final validation: ensure availableSpaces doesn't exceed totalSpaces
      if (updateData.availableSpaces > newTotalSpaces) {
        updateData.availableSpaces = newTotalSpaces;
      }
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
    // Check if service is being used in bookings - Disabled as per request to allow free deletion
    // const usedBookings = await Booking.find({
    //   'addonServices.service': id
    // });

    // if (usedBookings.length > 0) {
    //   return res.status(400).json({ 
    //     message: 'Không thể xóa dịch vụ đang được sử dụng' 
    //   });
    // }

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