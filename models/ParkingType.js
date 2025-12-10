const mongoose = require('mongoose');

const parkingTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['indoor', 'outdoor', 'disabled'],
    default: 'indoor'
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🏢'
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Parking lot properties
  totalSpaces: {
    type: Number,
    required: true,
    min: 1
  },
  availableSpaces: {
    type: Number,
    required: true,
    min: 0
  },
  pricePerDay: {
    type: Number,
    required: true,
    min: 0
  },
  specialPrices: [{
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  location: {
    type: String,
    trim: true
  },
  features: [{
    type: String,
    enum: ['covered', 'security', 'camera', 'lighting', 'accessible']
  }],
  operatingHours: {
    open: {
      type: String,
      default: '00:00'
    },
    close: {
      type: String,
      default: '23:59'
    }
  },
  // Image upload fields
  images: [{
    url: {
      type: String,
      required: true
    },
    thumbnailUrl: {
      type: String
    },
    cloudinaryId: {
      type: String,
      required: true
    },
    thumbnailCloudinaryId: {
      type: String
    },
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }]
}, {
  timestamps: true
});

// Index for better query performance
parkingTypeSchema.index({ isActive: 1 });
parkingTypeSchema.index({ type: 1 });
parkingTypeSchema.index({ name: 1 });

// Virtual for occupancy rate
parkingTypeSchema.virtual('occupancyRate').get(function() {
  return ((this.totalSpaces - this.availableSpaces) / this.totalSpaces * 100).toFixed(2);
});

// Method to check if parking type is available for given time
parkingTypeSchema.methods.isAvailableForTime = async function(startTime, endTime) {
  const Booking = require('./Booking');
  
  // Check if there are any overlapping bookings
  const overlappingBookings = await Booking.countDocuments({
    parkingType: this._id,
    status: { $in: ['pending', 'confirmed', 'checked-in'] },
    $or: [
      // New booking starts during existing booking
      {
        checkInTime: { $lt: endTime },
        checkOutTime: { $gt: startTime }
      },
      // New booking completely contains existing booking
      {
        checkInTime: { $gte: startTime },
        checkOutTime: { $lte: endTime }
      }
    ]
  });

  // Check if we have enough available spaces
  const availableSpaces = this.totalSpaces - overlappingBookings;
  return availableSpaces > 0;
};

// Method to get price for specific date
parkingTypeSchema.methods.getPriceForDate = function(date) {
  // Normalize dates to compare only the date part (ignore time)
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const specialPrice = this.specialPrices.find(sp => {
    if (!sp.isActive) return false;
    
    const startDate = new Date(sp.startDate);
    const endDate = new Date(sp.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999); // Include the entire end date
    
    return targetDate >= startDate && targetDate <= endDate;
  });
  
  return specialPrice ? specialPrice.price : this.pricePerDay;
};

// Method to calculate total price for a date range with daily breakdown
// cutoffHour: hour (0-23) that determines if first day is charged
//   - If check-in time < cutoffHour: first day is charged
//   - If check-in time >= cutoffHour: first day is free, charging starts from day 2
//   - Check-out day is always charged (1 day)
parkingTypeSchema.methods.calculatePriceForRange = async function(startTime, endTime, cutoffHour = null) {
  const SystemSettings = require('./SystemSettings');
  
  // Always get cutoffHour from settings if not explicitly provided
  if (cutoffHour === null || cutoffHour === undefined) {
    const settings = await SystemSettings.getSettings();
    cutoffHour = settings.cutoffHour !== undefined && settings.cutoffHour !== null ? Number(settings.cutoffHour) : 0;
  } else {
    cutoffHour = Number(cutoffHour);
  }
  
  // Ensure cutoffHour is a valid number between 0-23
  cutoffHour = Math.max(0, Math.min(23, Math.floor(cutoffHour)));
  
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  
  // Get check-in hour
  const checkInHour = startDate.getHours();
  
  // Determine if first day should be charged based on cutoff hour
  // If check-in hour is BEFORE cutoff hour, charge first day
  // If check-in hour is AT OR AFTER cutoff hour, first day is free
  const chargeFirstDay = checkInHour < cutoffHour;
  
  // Debug logging
  console.log('🔍 Pricing calculation:', {
    checkInTime: startDate.toISOString(),
    checkInHour,
    cutoffHour,
    chargeFirstDay,
    checkInDate: startDate.toLocaleString('vi-VN')
  });
  
  // Normalize dates to start of day for comparison
  const startDateOnly = new Date(startDate);
  startDateOnly.setHours(0, 0, 0, 0);
  
  const endDateOnly = new Date(endDate);
  endDateOnly.setHours(0, 0, 0, 0);
  
  // Calculate number of calendar days between start and end (inclusive)
  const daysDiff = Math.ceil((endDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));
  const isSameDay = (daysDiff === 0);
  
  // Calculate price for each day with details
  let totalPrice = 0;
  const dailyPrices = [];
  
  // Iterate through each day from start to end (inclusive)
  for (let i = 0; i <= daysDiff; i++) {
    const dayDate = new Date(startDateOnly);
    dayDate.setDate(startDateOnly.getDate() + i);
    
    const isFirstDay = (i === 0);
    const isLastDay = (i === daysDiff);
    
    // If same day: always charge (check-out day is always charged)
    if (isSameDay) {
      const dayPrice = this.getPriceForDate(dayDate);
      
      // Find special price for this date
      const targetDate = new Date(dayDate);
      targetDate.setHours(0, 0, 0, 0);
      
      const specialPrice = this.specialPrices.find(sp => {
        if (!sp.isActive) return false;
        
        const spStartDate = new Date(sp.startDate);
        const spEndDate = new Date(sp.endDate);
        spStartDate.setHours(0, 0, 0, 0);
        spEndDate.setHours(23, 59, 59, 999);
        
        return targetDate >= spStartDate && targetDate <= spEndDate;
      });
      
      dailyPrices.push({
        date: new Date(dayDate),
        price: dayPrice,
        isSpecialPrice: !!specialPrice,
        specialPriceReason: specialPrice ? specialPrice.reason : null,
        originalPrice: this.pricePerDay,
        isFree: false,
        reason: '進場與離場同日（始終計費）'
      });
      
      totalPrice += dayPrice;
      break;
    }
    
    // First day: check if it should be charged based on cutoff hour
    if (isFirstDay && !chargeFirstDay) {
      // First day is free (check-in after cutoff hour)
      dailyPrices.push({
        date: new Date(dayDate),
        price: 0,
        isSpecialPrice: false,
        specialPriceReason: null,
        originalPrice: this.pricePerDay,
        isFree: true,
        reason: '首日免費（進場時間晚於分界點）'
      });
      continue;
    }
    
    // Last day (check-out day) is always charged
    // Middle days and first day (if chargeFirstDay is true) are also charged
    const dayPrice = this.getPriceForDate(dayDate);
    
    // Find special price for this date
    const targetDate = new Date(dayDate);
    targetDate.setHours(0, 0, 0, 0);
    
    const specialPrice = this.specialPrices.find(sp => {
      if (!sp.isActive) return false;
      
      const spStartDate = new Date(sp.startDate);
      const spEndDate = new Date(sp.endDate);
      spStartDate.setHours(0, 0, 0, 0);
      spEndDate.setHours(23, 59, 59, 999);
      
      return targetDate >= spStartDate && targetDate <= spEndDate;
    });
    
    let reason = null;
    if (isFirstDay && chargeFirstDay) {
      reason = '進場日（早於分界點）';
    } else if (isLastDay) {
      reason = '離場日（始終計費）';
    }
    
    dailyPrices.push({
      date: new Date(dayDate),
      price: dayPrice,
      isSpecialPrice: !!specialPrice,
      specialPriceReason: specialPrice ? specialPrice.reason : null,
      originalPrice: this.pricePerDay,
      isFree: false,
      reason: reason
    });
    
    totalPrice += dayPrice;
  }
  
  // Calculate days to charge (excluding free days)
  const daysToCharge = dailyPrices.filter(dp => !dp.isFree).length;
  
  return {
    durationDays: daysDiff + 1, // Total calendar days
    daysToCharge: daysToCharge, // Actual days charged
    totalPrice: totalPrice,
    pricePerDay: this.pricePerDay,
    dailyPrices: dailyPrices,
    cutoffHour: cutoffHour,
    chargeFirstDay: chargeFirstDay
  };
};

module.exports = mongoose.model('ParkingType', parkingTypeSchema); 