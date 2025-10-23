const mongoose = require('mongoose');

const autoDiscountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Discount name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Discount description is required'],
    trim: true
  },
  minDays: {
    type: Number,
    required: [true, 'Minimum days is required'],
    min: 1
  },
  maxDays: {
    type: Number,
    min: 1
  },
  applicableParkingTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingType',
    required: true
  }],
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: [true, 'Discount type is required']
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: 0
  },
  maxDiscountAmount: {
    type: Number,
    min: 0
  },
  applyToSpecialPrices: {
    type: Boolean,
    default: false
  },
  validFrom: {
    type: Date,
    required: [true, 'Valid from date is required']
  },
  validTo: {
    type: Date,
    required: [true, 'Valid to date is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxUsage: {
    type: Number,
    default: -1, // -1 means unlimited
    min: -1
  },
  userRestrictions: {
    newUsersOnly: {
      type: Boolean,
      default: false
    },
    vipOnly: {
      type: Boolean,
      default: false
    },
    specificUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  conditions: {
    minBookingAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxBookingAmount: {
      type: Number,
      min: 0
    },
    specificDaysOfWeek: [{
      type: Number, // 0 = Sunday, 1 = Monday, etc.
      min: 0,
      max: 6
    }],
    specificTimeSlots: [{
      startTime: String, // Format: "HH:MM"
      endTime: String    // Format: "HH:MM"
    }]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
autoDiscountSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });
autoDiscountSchema.index({ applicableParkingTypes: 1 });
autoDiscountSchema.index({ minDays: 1, maxDays: 1 });
autoDiscountSchema.index({ priority: -1 });

// Virtual for is valid
autoDiscountSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.validTo >= now &&
         (this.maxUsage === -1 || this.usageCount < this.maxUsage);
});

// Method to check if discount applies to a booking
autoDiscountSchema.methods.appliesToBooking = function(bookingData) {
  const now = new Date();
  
  // Check if discount is valid
  if (!this.isActive || 
      this.validFrom > now || 
      this.validTo < now ||
      (this.maxUsage !== -1 && this.usageCount >= this.maxUsage)) {
    return false;
  }
  
  // Check parking type
  if (!this.applicableParkingTypes.includes(bookingData.parkingTypeId)) {
    return false;
  }
  
  // Check duration
  const durationDays = Math.ceil(
    (new Date(bookingData.checkOutTime) - new Date(bookingData.checkInTime)) / (1000 * 60 * 60 * 24)
  );
  
  if (durationDays < this.minDays) {
    return false;
  }
  
  if (this.maxDays && durationDays > this.maxDays) {
    return false;
  }
  
  // Check user restrictions
  if (this.userRestrictions.vipOnly && !bookingData.isVIP) {
    return false;
  }
  
  if (this.userRestrictions.newUsersOnly && bookingData.userRegistrationDate) {
    const daysSinceRegistration = Math.ceil(
      (now - new Date(bookingData.userRegistrationDate)) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceRegistration > 30) { // Consider new users as registered within 30 days
      return false;
    }
  }
  
  if (this.userRestrictions.specificUsers.length > 0 && 
      !this.userRestrictions.specificUsers.includes(bookingData.userId)) {
    return false;
  }
  
  // Check conditions
  if (this.conditions.minBookingAmount > 0 && bookingData.totalAmount < this.conditions.minBookingAmount) {
    return false;
  }
  
  if (this.conditions.maxBookingAmount && bookingData.totalAmount > this.conditions.maxBookingAmount) {
    return false;
  }
  
  // Check specific days of week
  if (this.conditions.specificDaysOfWeek.length > 0) {
    const checkInDay = new Date(bookingData.checkInTime).getDay();
    if (!this.conditions.specificDaysOfWeek.includes(checkInDay)) {
      return false;
    }
  }
  
  // Check specific time slots
  if (this.conditions.specificTimeSlots.length > 0) {
    const checkInTime = new Date(bookingData.checkInTime);
    const timeStr = `${checkInTime.getHours().toString().padStart(2, '0')}:${checkInTime.getMinutes().toString().padStart(2, '0')}`;
    
    const isInTimeSlot = this.conditions.specificTimeSlots.some(slot => {
      return timeStr >= slot.startTime && timeStr <= slot.endTime;
    });
    
    if (!isInTimeSlot) {
      return false;
    }
  }
  
  return true;
};

// Method to calculate discount amount
autoDiscountSchema.methods.calculateDiscount = function(bookingData) {
  if (!this.appliesToBooking(bookingData)) {
    return 0;
  }
  
  // Calculate number of days
  const durationDays = Math.ceil(
    (new Date(bookingData.checkOutTime) - new Date(bookingData.checkInTime)) / (1000 * 60 * 60 * 24)
  );
  
  let discountAmount = 0;
  
  if (this.discountType === 'percentage') {
    // For percentage: calculate daily rate and apply percentage to each day
    const dailyRate = bookingData.totalAmount / durationDays;
    const dailyDiscount = (dailyRate * this.discountValue) / 100;
    discountAmount = dailyDiscount * durationDays;
  } else if (this.discountType === 'fixed') {
    // For fixed: apply fixed amount per day
    discountAmount = this.discountValue * durationDays;
  }
  
  // Apply max discount limit
  if (this.maxDiscountAmount && discountAmount > this.maxDiscountAmount) {
    discountAmount = this.maxDiscountAmount;
  }
  
  // Don't exceed the total amount
  return Math.min(discountAmount, bookingData.totalAmount);
};

// Method to increment usage count
autoDiscountSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

module.exports = mongoose.model('AutoDiscount', autoDiscountSchema);
