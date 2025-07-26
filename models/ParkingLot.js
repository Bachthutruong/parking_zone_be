const mongoose = require('mongoose');

const parkingLotSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Parking lot name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['indoor', 'outdoor', 'disabled'],
    required: [true, 'Parking type is required']
  },
  totalSpaces: {
    type: Number,
    required: [true, 'Total spaces is required'],
    min: 1
  },
  availableSpaces: {
    type: Number,
    required: [true, 'Available spaces is required'],
    min: 0
  },
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: 0
  },
  pricePerDay: {
    type: Number,
    required: [true, 'Price per day is required'],
    min: 0
  },
  specialPrices: [{
    date: {
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
    }
  }],
  description: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
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
  }
}, {
  timestamps: true
});

// Virtual for occupancy rate
parkingLotSchema.virtual('occupancyRate').get(function() {
  return ((this.totalSpaces - this.availableSpaces) / this.totalSpaces * 100).toFixed(2);
});

// Method to check if parking lot is available for given time
parkingLotSchema.methods.isAvailableForTime = async function(startTime, endTime) {
  const Booking = require('./Booking');
  
  // Check if there are any overlapping bookings
  const overlappingBookings = await Booking.countDocuments({
    parkingLot: this._id,
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
parkingLotSchema.methods.getPriceForDate = function(date) {
  const specialPrice = this.specialPrices.find(sp => 
    sp.date.toDateString() === date.toDateString()
  );
  return specialPrice ? specialPrice.price : this.pricePerDay;
};

// Method to calculate total price for a date range
parkingLotSchema.methods.calculatePriceForRange = function(startTime, endTime) {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  
  // Calculate duration in days (rounded up)
  const durationMs = endDate - startDate;
  const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
  
  // If duration is less than 1 day, charge for 1 day
  const daysToCharge = Math.max(1, durationDays);
  
  // Calculate price for each day
  let totalPrice = 0;
  const currentDate = new Date(startDate);
  
  for (let i = 0; i < daysToCharge; i++) {
    const dayPrice = this.getPriceForDate(currentDate);
    totalPrice += dayPrice;
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return {
    durationDays: durationDays,
    daysToCharge: daysToCharge,
    totalPrice: totalPrice,
    pricePerDay: this.pricePerDay
  };
};

module.exports = mongoose.model('ParkingLot', parkingLotSchema); 