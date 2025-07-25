const SystemSettings = require('../models/SystemSettings');

// Get system settings
const getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error getting system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải cài đặt hệ thống'
    });
  }
};

// Update system settings (admin only)
const updateSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    const updatedSettings = await SystemSettings.findByIdAndUpdate(
      settings._id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      settings: updatedSettings,
      message: 'Cập nhật cài đặt thành công'
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật cài đặt hệ thống'
    });
  }
};

// Get booking terms and rules
const getBookingTerms = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json({
      success: true,
      bookingTerms: settings.bookingTerms,
      bookingRules: settings.bookingRules,
      timeSlotInterval: settings.timeSlotInterval
    });
  } catch (error) {
    console.error('Error getting booking terms:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải điều khoản đặt chỗ'
    });
  }
};

// Update booking terms and rules (admin only)
const updateBookingTerms = async (req, res) => {
  try {
    const { bookingTerms, bookingRules } = req.body;
    const settings = await SystemSettings.getSettings();
    
    const updatedSettings = await SystemSettings.findByIdAndUpdate(
      settings._id,
      { bookingTerms, bookingRules },
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Cập nhật điều khoản thành công',
      bookingTerms: updatedSettings.bookingTerms,
      bookingRules: updatedSettings.bookingRules
    });
  } catch (error) {
    console.error('Error updating booking terms:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật điều khoản'
    });
  }
};

// Get parking lot types configuration
const getParkingLotTypes = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json({
      success: true,
      types: settings.getActiveParkingLotTypes()
    });
  } catch (error) {
    console.error('Error getting parking lot types:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải cấu hình loại bãi đậu xe'
    });
  }
};

// Update parking lot types configuration (admin only)
const updateParkingLotTypes = async (req, res) => {
  try {
    const { types } = req.body;
    const settings = await SystemSettings.getSettings();
    
    const updatedSettings = await SystemSettings.findByIdAndUpdate(
      settings._id,
      { parkingLotTypes: types },
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Cập nhật cấu hình loại bãi đậu xe thành công',
      types: updatedSettings.getActiveParkingLotTypes()
    });
  } catch (error) {
    console.error('Error updating parking lot types:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật cấu hình loại bãi đậu xe'
    });
  }
};

module.exports = {
  getSystemSettings,
  updateSystemSettings,
  getBookingTerms,
  updateBookingTerms,
  getParkingLotTypes,
  updateParkingLotTypes
}; 