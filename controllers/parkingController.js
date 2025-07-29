const ParkingType = require('../models/ParkingType');
const Booking = require('../models/Booking');

// Get all parking types
exports.getAllParkingTypes = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    
    const query = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const parkingTypes = await ParkingType.find(query)
      .sort({ createdAt: -1 });

    // For general listing, show total capacity (not time-specific availability)
    const parkingTypesWithCapacity = parkingTypes.map((parkingType) => {
      return {
        ...parkingType.toObject(),
        availableSpaces: parkingType.totalSpaces // Show full capacity for general listing
      };
    });

    res.json({ parkingTypes: parkingTypesWithCapacity });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get parking type by ID
exports.getParkingTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const parkingType = await ParkingType.findById(id);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    res.json({ parkingType });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get parking type availability for a specific date
exports.getParkingTypeAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    const parkingType = await ParkingType.findById(id);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    if (!date) {
      return res.status(400).json({ message: 'Thiếu thông tin ngày' });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Count overlapping bookings for this specific day
    const overlappingBookings = await Booking.countDocuments({
      parkingType: parkingType._id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
      $or: [
        {
          checkInTime: { $lt: endOfDay },
          checkOutTime: { $gt: startOfDay }
        }
      ]
    });

    const availableSpaces = Math.max(0, parkingType.totalSpaces - overlappingBookings);

    res.json({
      parkingTypeId: parkingType._id,
      date: date,
      totalSpaces: parkingType.totalSpaces,
      availableSpaces: availableSpaces,
      occupiedSpaces: overlappingBookings,
      isAvailable: availableSpaces > 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get parking type availability for a month
exports.getParkingTypeMonthAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { year, month } = req.query;

    const parkingType = await ParkingType.findById(id);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    if (!year || !month) {
      return res.status(400).json({ message: 'Thiếu thông tin năm hoặc tháng' });
    }

    const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

    // Get all bookings for this month
    const monthBookings = await Booking.find({
      parkingType: parkingType._id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
      $or: [
        {
          checkInTime: { $lt: endOfMonth },
          checkOutTime: { $gt: startOfMonth }
        }
      ]
    });

    // Calculate availability for each day in the month
    const daysInMonth = endOfMonth.getDate();
    const availabilityData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(parseInt(year), parseInt(month) - 1, day);
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Count overlapping bookings for this day
      const overlappingBookings = monthBookings.filter(booking => {
        return booking.checkInTime < endOfDay && booking.checkOutTime > startOfDay;
      }).length;

      const availableSpaces = Math.max(0, parkingType.totalSpaces - overlappingBookings);
      const isInPast = currentDate < new Date();

      availabilityData.push({
        date: currentDate.toISOString().split('T')[0],
        isAvailable: !isInPast && availableSpaces > 0,
        availableSpaces: isInPast ? 0 : availableSpaces,
        occupiedSpaces: overlappingBookings,
        totalSpaces: parkingType.totalSpaces,
        price: parkingType.pricePerDay,
        isInPast: isInPast
      });
    }

    res.json({
      parkingTypeId: parkingType._id,
      year: parseInt(year),
      month: parseInt(month),
      availabilityData: availabilityData
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Create parking type
exports.createParkingType = async (req, res) => {
  try {
    const {
      name,
      type,
      totalSpaces,
      basePrice,
      pricePerDay,
      description,
      location,
      features,
      operatingHours
    } = req.body;

    const parkingType = await ParkingType.create({
      name,
      type,
      totalSpaces,
      availableSpaces: totalSpaces,
      basePrice,
      pricePerDay,
      description,
      location,
      features,
      operatingHours
    });

    res.status(201).json({
      message: 'Tạo loại bãi đậu xe thành công',
      parkingType
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update parking type
exports.updateParkingType = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const parkingType = await ParkingType.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    res.json({
      message: 'Cập nhật loại bãi đậu xe thành công',
      parkingType
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Delete parking type
exports.deleteParkingType = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are active bookings
    const activeBookings = await Booking.find({
      parkingType: id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa loại bãi đậu xe có đặt chỗ đang hoạt động' 
      });
    }

    const parkingType = await ParkingType.findByIdAndDelete(id);
    if (!parkingType) {
      return res.status(404).json({ message: 'Không tìm thấy loại bãi đậu xe' });
    }

    res.json({ message: 'Xóa loại bãi đậu xe thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
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
      pricePerDay,
      description,
      location,
      features,
      operatingHours
    } = req.body;

    const parkingLot = await ParkingLot.create({
      name,
      type,
      totalSpaces,
      availableSpaces: totalSpaces,
      basePrice,
      pricePerDay,
      description,
      location,
      features,
      operatingHours
    });

    res.status(201).json({
      message: 'Tạo bãi đậu xe thành công',
      parkingLot
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update parking lot
exports.updateParkingLot = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const parkingLot = await ParkingLot.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!parkingLot) {
      return res.status(404).json({ message: 'Không tìm thấy bãi đậu xe' });
    }

    res.json({
      message: 'Cập nhật bãi đậu xe thành công',
      parkingLot
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Delete parking lot
exports.deleteParkingLot = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are active bookings
    const activeBookings = await Booking.find({
      parkingLot: id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa bãi đậu xe có đặt chỗ đang hoạt động' 
      });
    }

    const parkingLot = await ParkingLot.findByIdAndDelete(id);
    if (!parkingLot) {
      return res.status(404).json({ message: 'Không tìm thấy bãi đậu xe' });
    }

    res.json({ message: 'Xóa bãi đậu xe thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Add special price
exports.addSpecialPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, price, reason } = req.body;

    const parkingLot = await ParkingLot.findById(id);
    if (!parkingLot) {
      return res.status(404).json({ message: 'Không tìm thấy bãi đậu xe' });
    }

    // Check if special price already exists for this date
    const existingPrice = parkingLot.specialPrices.find(
      sp => sp.date.toDateString() === new Date(date).toDateString()
    );

    if (existingPrice) {
      existingPrice.price = price;
      existingPrice.reason = reason;
    } else {
      parkingLot.specialPrices.push({ date, price, reason });
    }

    await parkingLot.save();

    res.json({
      message: 'Thêm giá đặc biệt thành công',
      parkingLot
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Remove special price
exports.removeSpecialPrice = async (req, res) => {
  try {
    const { id, priceId } = req.params;

    const parkingLot = await ParkingLot.findById(id);
    if (!parkingLot) {
      return res.status(404).json({ message: 'Không tìm thấy bãi đậu xe' });
    }

    parkingLot.specialPrices = parkingLot.specialPrices.filter(
      sp => sp._id.toString() !== priceId
    );

    await parkingLot.save();

    res.json({
      message: 'Xóa giá đặc biệt thành công',
      parkingLot
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};



module.exports = exports; 