const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'staff', 'admin'],
    default: 'user'
  },
  isVIP: {
    type: Boolean,
    default: false
  },
  vipDiscount: {
    type: Number,
    default: 0, // Percentage discount for VIP users
    min: 0,
    max: 100
  },
  vipCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  vipCreatedAt: {
    type: Date
  },
  licensePlate: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Generate VIP code method
userSchema.methods.generateVIPCode = function() {
  const currentYear = new Date().getFullYear();
  const yearCode = currentYear === 2025 ? '114' : currentYear === 2026 ? '115' : '114'; // Default to 114 for other years
  
  // Clean phone number - remove all non-digits and handle country codes
  let phoneNumber = this.phone.replace(/\D/g, ''); // Remove non-digits
  
  // If phone starts with country code (886), remove it
  if (phoneNumber.startsWith('886')) {
    phoneNumber = phoneNumber.substring(3);
  }
  
  // Ensure phone number is 10 digits (Taiwan format)
  if (phoneNumber.length > 10) {
    phoneNumber = phoneNumber.substring(phoneNumber.length - 10);
  }
  
  return `${yearCode}${phoneNumber}`;
};

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema); 