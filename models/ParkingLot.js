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
  pricePerHour: {
    type: Number,
    required: [true, 'Price per hour is required'],
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
parkingLotSchema.methods.isAvailableForTime = function(startTime, endTime) {
  // This would need to be implemented with actual booking logic
  return this.availableSpaces > 0;
};

// Method to get price for specific date
parkingLotSchema.methods.getPriceForDate = function(date) {
  const specialPrice = this.specialPrices.find(sp => 
    sp.date.toDateString() === date.toDateString()
  );
  return specialPrice ? specialPrice.price : this.basePrice;
};

module.exports = mongoose.model('ParkingLot', parkingLotSchema); 