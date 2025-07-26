const ParkingLot = require('../models/ParkingLot');
const Booking = require('../models/Booking');

// Get all parking lots
exports.getAllParkingLots = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    
    const query = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const parkingLots = await ParkingLot.find(query)
      .sort({ createdAt: -1 });

    // For general listing, show total capacity (not time-specific availability)
    const parkingLotsWithCapacity = parkingLots.map((lot) => {
      return {
        ...lot.toObject(),
        availableSpaces: lot.totalSpaces // Show full capacity for general listing
      };
    });

    res.json({ parkingLots: parkingLotsWithCapacity });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get parking lot by ID
exports.getParkingLotById = async (req, res) => {
  try {
    const { id } = req.params;

    const parkingLot = await ParkingLot.findById(id);
    if (!parkingLot) {
      return res.status(404).json({ message: 'Không tìm thấy bãi đậu xe' });
    }

    res.json({ parkingLot });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get parking lot availability for a specific date
exports.getParkingLotAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    const parkingLot = await ParkingLot.findById(id);
    if (!parkingLot) {
      return res.status(404).json({ message: 'Không tìm thấy bãi đậu xe' });
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
      parkingLot: parkingLot._id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
      $or: [
        {
          checkInTime: { $lt: endOfDay },
          checkOutTime: { $gt: startOfDay }
        }
      ]
    });

    const availableSpaces = Math.max(0, parkingLot.totalSpaces - overlappingBookings);

    res.json({
      parkingLotId: parkingLot._id,
      date: date,
      totalSpaces: parkingLot.totalSpaces,
      availableSpaces: availableSpaces,
      occupiedSpaces: overlappingBookings,
      isAvailable: availableSpaces > 0
    });
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