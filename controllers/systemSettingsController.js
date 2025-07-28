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



module.exports = {
  getSystemSettings,
  updateSystemSettings,
  getBookingTerms,
  updateBookingTerms
}; 