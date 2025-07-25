const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parkingLot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingLot',
    required: true
  },
  licensePlate: {
    type: String,
    required: [true, 'License plate is required'],
    trim: true
  },
  driverName: {
    type: String,
    required: [true, 'Driver name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true
  },
  checkInTime: {
    type: Date,
    required: [true, 'Check-in time is required']
  },
  checkOutTime: {
    type: Date,
    required: [true, 'Check-out time is required']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'],
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  addonServices: [{
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AddonService'
    },
    price: {
      type: Number,
      required: true
    }
  }],
  discountCode: {
    code: String,
    discountAmount: Number,
    discountType: {
      type: String,
      enum: ['percentage', 'fixed']
    }
  },
  luggageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  passengerCount: {
    type: Number,
    default: 1,
    min: 1
  },
  estimatedArrivalTime: {
    type: Date
  },
  flightNumber: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  isVIP: {
    type: Boolean,
    default: false
  },
  vipDiscount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit_card', 'online'],
    default: 'cash'
  },
  actualCheckInTime: {
    type: Date
  },
  actualCheckOutTime: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isManualBooking: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Virtual for duration in hours
bookingSchema.virtual('durationHours').get(function() {
  const duration = this.checkOutTime - this.checkInTime;
  return Math.ceil(duration / (1000 * 60 * 60)); // Convert to hours
});

// Virtual for is overdue
bookingSchema.virtual('isOverdue').get(function() {
  if (this.status === 'checked-in' && this.actualCheckInTime) {
    return new Date() > this.checkOutTime;
  }
  return false;
});

// Index for efficient queries
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ parkingLot: 1, checkInTime: 1, checkOutTime: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ licensePlate: 1, phone: 1 });

module.exports = mongoose.model('Booking', bookingSchema); 