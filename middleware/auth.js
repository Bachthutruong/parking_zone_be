const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: '未提供驗證憑證' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: '憑證無效' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: '帳號已停用' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: '憑證無效' });
  }
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: '需要驗證' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: '無存取權限，所需角色：' + roles.join('、') 
      });
    }

    next();
  };
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  return requireRole(['admin'])(req, res, next);
};

// Staff or Admin middleware
const requireStaff = (req, res, next) => {
  return requireRole(['admin', 'staff'])(req, res, next);
};

// Optional authentication (for public routes that can work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  auth,
  requireRole,
  requireAdmin,
  requireStaff,
  optionalAuth
}; 