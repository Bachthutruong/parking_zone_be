const MaintenanceDay = require('../models/MaintenanceDay');
const ParkingType = require('../models/ParkingType');

// Get all maintenance days
exports.getAllMaintenanceDays = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    
    let query = {};
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const maintenanceDays = await MaintenanceDay.find(query)
      .populate('affectedParkingTypes', 'name code')
      .populate('createdBy', 'name email')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await MaintenanceDay.countDocuments(query);
    
    res.json({
      maintenanceDays,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Create maintenance day
exports.createMaintenanceDay = async (req, res) => {
  try {
    const { date, reason, description, affectedParkingTypes } = req.body;
    
    // Check if maintenance day already exists for this date
    const existingMaintenance = await MaintenanceDay.findOne({
      date: new Date(date)
    });
    
    if (existingMaintenance) {
      return res.status(400).json({ message: 'Ngày bảo trì đã tồn tại cho ngày này' });
    }
    
    const maintenanceDay = await MaintenanceDay.create({
      date: new Date(date),
      reason,
      description,
      affectedParkingTypes,
      createdBy: req.user._id
    });
    
    await maintenanceDay.populate('affectedParkingTypes', 'name code');
    await maintenanceDay.populate('createdBy', 'name email');
    
    res.status(201).json({
      message: 'Tạo ngày bảo trì thành công',
      maintenanceDay
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update maintenance day
exports.updateMaintenanceDay = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, reason, description, affectedParkingTypes, isActive } = req.body;
    
    const maintenanceDay = await MaintenanceDay.findByIdAndUpdate(
      id,
      {
        date: new Date(date),
        reason,
        description,
        affectedParkingTypes,
        isActive
      },
      { new: true }
    ).populate('affectedParkingTypes', 'name code')
     .populate('createdBy', 'name email');
    
    if (!maintenanceDay) {
      return res.status(404).json({ message: 'Không tìm thấy ngày bảo trì' });
    }
    
    res.json({
      message: 'Cập nhật ngày bảo trì thành công',
      maintenanceDay
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Delete maintenance day
exports.deleteMaintenanceDay = async (req, res) => {
  try {
    const { id } = req.params;
    
    const maintenanceDay = await MaintenanceDay.findByIdAndDelete(id);
    
    if (!maintenanceDay) {
      return res.status(404).json({ message: 'Không tìm thấy ngày bảo trì' });
    }
    
    res.json({ message: 'Xóa ngày bảo trì thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get maintenance day by ID
exports.getMaintenanceDayById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const maintenanceDay = await MaintenanceDay.findById(id)
      .populate('affectedParkingTypes', 'name code')
      .populate('createdBy', 'name email');
    
    if (!maintenanceDay) {
      return res.status(404).json({ message: 'Không tìm thấy ngày bảo trì' });
    }
    
    res.json({ maintenanceDay });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Check if date range has maintenance days
exports.checkMaintenanceDays = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Vui lòng cung cấp ngày bắt đầu và kết thúc' });
    }
    
    const maintenanceDays = await MaintenanceDay.getMaintenanceDaysForRange(
      new Date(startDate),
      new Date(endDate)
    );
    
    res.json({ maintenanceDays });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
}; 