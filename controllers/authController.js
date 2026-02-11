const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Register user
const register = async (req, res) => {
  try {
    const { name, email, phone, password, licensePlate } = req.body;

    // Check if user already exists
    const query = { $or: [{ phone }] };
    if (email) {
      query.$or.push({ email });
    }

    const existingUser = await User.findOne(query);

    if (existingUser) {
      return res.status(400).json({
        error: '此電話號碼或電子郵件已被註冊'
      });
    }

    // Create new user
    const user = new User({
      name,
      email: email || undefined,
      phone,
      password,
      licensePlate
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: '註冊成功',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVIP: user.isVIP,
        vipDiscount: user.vipDiscount
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: '註冊時發生伺服器錯誤' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: '登入成功',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVIP: user.isVIP,
        vipDiscount: user.vipDiscount
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登入時發生伺服器錯誤' });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone, licensePlate, address } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: '找不到使用者' });
    }

    // Update fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (licensePlate) user.licensePlate = licensePlate;
    if (address) user.address = address;

    await user.save();

    res.json({
      message: '個人資料更新成功',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        licensePlate: user.licensePlate,
        address: user.address,
        role: user.role,
        isVIP: user.isVIP,
        vipDiscount: user.vipDiscount
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: '找不到使用者' });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: '目前密碼不正確' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: '密碼變更成功' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
};

// Get system settings for booking terms
const getBookingTerms = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json({
      terms: settings.bookingTerms,
      rules: settings.bookingRules,
      contactInfo: settings.contactInfo
    });
  } catch (error) {
    console.error('Get booking terms error:', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
};

// Check VIP status by email
const checkVIPStatus = async (req, res) => {
  try {
    const { phone, email } = req.body;
    
    if (!phone && !email) {
      return res.status(400).json({ 
        success: false,
        message: '請輸入電話號碼或電子郵件' 
      });
    }

    // Find user by phone or email
    let query = {};
    if (phone) {
      query.phone = phone;
    } else {
      query.email = email;
    }

    const user = await User.findOne(query).select('name email phone isVIP vipDiscount vipCode vipCreatedAt');
    
    if (!user) {
      return res.json({
        success: false,
        message: '找不到使用者',
        isVIP: false,
        vipDiscount: 0
      });
    }

    res.json({
      success: true,
      message: user.isVIP ? '此使用者為 VIP 會員' : '此使用者非 VIP 會員',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVIP: user.isVIP,
        vipDiscount: user.vipDiscount || 0,
        vipCode: user.vipCode,
        vipCreatedAt: user.vipCreatedAt
      },
      isVIP: user.isVIP,
      vipDiscount: user.vipDiscount || 0
    });
  } catch (error) {
    console.error('Error checking VIP status:', error);
    res.status(500).json({ 
      success: false,
      message: '查詢 VIP 狀態時發生伺服器錯誤',
      error: error.message 
    });
  }
};

// Check VIP status by VIP code
const checkVIPByCode = async (req, res) => {
  try {
    const { vipCode } = req.body;
    
    if (!vipCode) {
      return res.status(400).json({ 
        success: false,
        message: '請輸入 VIP 代碼' 
      });
    }

    // Find user by VIP code
    const user = await User.findOne({ 
      vipCode: vipCode.trim(),
      isVIP: true,
      isActive: true
    }).select('name email phone isVIP vipDiscount vipCode vipCreatedAt');
    
    if (!user) {
      return res.json({
        success: false,
        message: 'VIP 代碼無效或不存在',
        isVIP: false,
        vipDiscount: 0
      });
    }

    res.json({
      success: true,
      message: 'VIP 代碼有效',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVIP: user.isVIP,
        vipDiscount: user.vipDiscount || 0,
        vipCode: user.vipCode,
        vipCreatedAt: user.vipCreatedAt
      },
      isVIP: user.isVIP,
      vipDiscount: user.vipDiscount || 0
    });
  } catch (error) {
    console.error('Error checking VIP by code:', error);
    res.status(500).json({ 
      success: false,
      message: '查詢 VIP 代碼時發生伺服器錯誤',
      error: error.message 
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getBookingTerms,
  checkVIPStatus,
  checkVIPByCode
}; 