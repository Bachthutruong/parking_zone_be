const mongoose = require('mongoose');

const parkingTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
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
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  maxSpots: {
    type: Number,
    required: true,
    min: 1
  },
  features: [{
    type: String,
    trim: true
  }],
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
    description: String
  }]
}, {
  timestamps: true
});

// Index for better query performance
parkingTypeSchema.index({ isActive: 1 });
parkingTypeSchema.index({ name: 1 });

module.exports = mongoose.model('ParkingType', parkingTypeSchema); 