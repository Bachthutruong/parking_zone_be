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
parkingTypeSchema.methods.calculatePriceForRange = function(startTime, endTime) {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  
  // Calculate duration in days (rounded up)
  const durationMs = endDate - startDate;
  const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
  
  // If duration is less than 1 day, charge for 1 day
  const daysToCharge = Math.max(1, durationDays);
  
  
  // Calculate price for each day with details
  let totalPrice = 0;
  const dailyPrices = [];
  const currentDate = new Date(startDate);
  
  for (let i = 0; i < daysToCharge; i++) {
    const dayPrice = this.getPriceForDate(currentDate);
    
    // Find special price for this date (using the same logic as getPriceForDate)
    const targetDate = new Date(currentDate);
    targetDate.setHours(0, 0, 0, 0);
    
    const specialPrice = this.specialPrices.find(sp => {
      if (!sp.isActive) return false;
      
      const startDate = new Date(sp.startDate);
      const endDate = new Date(sp.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      return targetDate >= startDate && targetDate <= endDate;
    });
    
    
    dailyPrices.push({
      date: new Date(currentDate),
      price: dayPrice,
      isSpecialPrice: !!specialPrice,
      specialPriceReason: specialPrice ? specialPrice.reason : null,
      originalPrice: this.pricePerDay
    });
    
    totalPrice += dayPrice;
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return {
    durationDays: durationDays,
    daysToCharge: daysToCharge,
    totalPrice: totalPrice,
    pricePerDay: this.pricePerDay,
    dailyPrices: dailyPrices
  };
};

module.exports = mongoose.model('ParkingType', parkingTypeSchema); 