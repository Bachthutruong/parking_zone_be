const DiscountCode = require('../models/DiscountCode');
const Booking = require('../models/Booking');

// Get all discount codes
exports.getAllDiscountCodes = async (req, res) => {
  try {
    const { isActive, discountType } = req.query;
    
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (discountType) query.discountType = discountType;

    const codes = await DiscountCode.find(query)
      .sort({ createdAt: -1 });

    res.json({ codes });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get discount code by ID
exports.getDiscountCodeById = async (req, res) => {
  try {
    const { id } = req.params;

    const code = await DiscountCode.findById(id);
    if (!code) {
      return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
    }

    res.json({ code });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Create discount code
exports.createDiscountCode = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      validFrom,
      validTo,
      maxUsage,
      description,
      minimumAmount
    } = req.body;

    // Check if code already exists
    const existingCode = await DiscountCode.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({ message: 'Mã giảm giá đã tồn tại' });
    }

    const discountCode = await DiscountCode.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      validFrom,
      validTo,
      maxUsage,
      description,
      minimumAmount
    });

    res.status(201).json({
      message: 'Tạo mã giảm giá thành công',
      code: discountCode
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update discount code
exports.updateDiscountCode = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const code = await DiscountCode.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!code) {
      return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
    }

    res.json({
      message: 'Cập nhật mã giảm giá thành công',
      code
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Delete discount code
exports.deleteDiscountCode = async (req, res) => {
  try {
    const { id } = req.params;

    const code = await DiscountCode.findByIdAndDelete(id);
    if (!code) {
      return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
    }

    res.json({ message: 'Xóa mã giảm giá thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Toggle discount code status
exports.toggleDiscountCodeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const code = await DiscountCode.findById(id);
    if (!code) {
      return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
    }

    code.isActive = !code.isActive;
    await code.save();

    res.json({
      message: `${code.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} mã giảm giá thành công`,
      code
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Validate discount code
exports.validateDiscountCode = async (req, res) => {
  try {
    const { code, amount } = req.body;

    const discountCode = await DiscountCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() }
    });

    if (!discountCode) {
      return res.status(404).json({ message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
    }

    // Check minimum amount
    if (discountCode.minimumAmount && amount < discountCode.minimumAmount) {
      return res.status(400).json({ 
        message: `Đơn hàng tối thiểu phải là ${discountCode.minimumAmount} TWD` 
      });
    }

    // Check usage limit
    if (discountCode.maxUsage && discountCode.currentUsage >= discountCode.maxUsage) {
      return res.status(400).json({ message: 'Mã giảm giá đã hết lượt sử dụng' });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discountCode.discountType === 'percentage') {
      discountAmount = amount * (discountCode.discountValue / 100);
    } else {
      discountAmount = Math.min(discountCode.discountValue, amount);
    }

    res.json({
      message: 'Mã giảm giá hợp lệ',
      code: {
        _id: discountCode._id,
        code: discountCode.code,
        discountType: discountCode.discountType,
        discountValue: discountCode.discountValue,
        discountAmount,
        description: discountCode.description
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get discount code usage statistics
exports.getDiscountCodeStats = async (req, res) => {
  try {
    const { id } = req.params;

    const code = await DiscountCode.findById(id);
    if (!code) {
      return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
    }

    // Get bookings that used this discount code
    const bookings = await Booking.find({
      'discountCode.code': code.code
    }).populate('user', 'name email');

    const totalDiscount = bookings.reduce((sum, booking) => {
      return sum + (booking.discountAmount || 0);
    }, 0);

    const totalRevenue = bookings.reduce((sum, booking) => {
      return sum + (booking.finalAmount || 0);
    }, 0);

    res.json({
      code,
      usageStats: {
        totalUsage: bookings.length,
        totalDiscount,
        totalRevenue,
        averageDiscount: bookings.length > 0 ? totalDiscount / bookings.length : 0,
        usageRate: code.maxUsage ? (bookings.length / code.maxUsage * 100).toFixed(2) : null
      },
      recentBookings: bookings.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get active discount codes
exports.getActiveDiscountCodes = async (req, res) => {
  try {
    const codes = await DiscountCode.find({
      isActive: true,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() }
    }).sort({ createdAt: -1 });

    res.json({ codes });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

module.exports = exports; 