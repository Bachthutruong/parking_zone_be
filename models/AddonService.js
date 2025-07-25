const mongoose = require('mongoose');

const addonServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    required: [true, 'Service icon is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Service price is required'],
    min: 0
  },
  isFree: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['transport', 'cleaning', 'security', 'convenience', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  requiresAdvanceBooking: {
    type: Boolean,
    default: false
  },
  advanceBookingHours: {
    type: Number,
    default: 0, // Hours in advance required for booking
    min: 0
  },
  maxQuantity: {
    type: Number,
    default: 1, // Maximum quantity per booking
    min: 1
  },
  availability: {
    startTime: {
      type: String,
      default: '00:00'
    },
    endTime: {
      type: String,
      default: '23:59'
    },
    daysOfWeek: [{
      type: Number, // 0 = Sunday, 1 = Monday, etc.
      min: 0,
      max: 6
    }]
  },
  terms: {
    type: String,
    trim: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Virtual for display price
addonServiceSchema.virtual('displayPrice').get(function() {
  return this.isFree ? 0 : this.price;
});

// Method to check if service is available for given time
addonServiceSchema.methods.isAvailableForTime = function(dateTime) {
  if (!this.isActive) return false;
  
  const date = new Date(dateTime);
  const dayOfWeek = date.getDay();
  const timeString = date.toTimeString().slice(0, 5);
  
  // Check if service is available on this day
  if (this.availability.daysOfWeek.length > 0 && 
      !this.availability.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }
  
  // Check if service is available at this time
  return timeString >= this.availability.startTime && 
         timeString <= this.availability.endTime;
};

// Static method to get default services
addonServiceSchema.statics.getDefaultServices = function() {
  return [
    {
      name: 'Đưa đón sân bay',
      description: 'Dịch vụ đưa đón từ sân bay đến bãi đậu xe',
      icon: '🚐',
      price: 0,
      isFree: true,
      category: 'transport',
      sortOrder: 1
    },
    {
      name: 'Ký gửi đồ',
      description: 'Dịch vụ ký gửi hành lý trong thời gian đỗ xe',
      icon: '📦',
      price: 0,
      isFree: true,
      category: 'convenience',
      sortOrder: 2
    },
    {
      name: 'Rửa xe',
      description: 'Dịch vụ rửa xe cơ bản',
      icon: '🚗',
      price: 300,
      category: 'cleaning',
      sortOrder: 3
    },
    {
      name: 'Đánh bóng & chăm sóc ngoại thất',
      description: 'Dịch vụ đánh bóng và chăm sóc ngoại thất xe',
      icon: '✨',
      price: 800,
      category: 'cleaning',
      sortOrder: 4
    },
    {
      name: 'Khử trùng nội thất',
      description: 'Dịch vụ khử trùng và làm sạch nội thất xe',
      icon: '🧴',
      price: 500,
      category: 'cleaning',
      sortOrder: 5
    }
  ];
};

// Index for efficient queries
addonServiceSchema.index({ isActive: 1, sortOrder: 1 });
addonServiceSchema.index({ category: 1 });

module.exports = mongoose.model('AddonService', addonServiceSchema); 