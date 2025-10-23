const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parkingType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingType',
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
    default: 'confirmed'
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
  autoDiscount: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AutoDiscount'
    },
    name: String,
    description: String,
    discountAmount: Number,
    discountType: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    discountValue: Number,
    applyToSpecialPrices: Boolean
  },
  luggageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  passengerCount: {
    type: Number,
    default: 0,
    min: 0
  },
  departureTerminal: {
    type: String,
    enum: ['terminal1', 'terminal2']
  },
  returnTerminal: {
    type: String,
    enum: ['terminal1', 'terminal2']
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

// Virtual for booking number
bookingSchema.virtual('bookingNumber').get(function() {
  const date = new Date(this.createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}${month}${day}`;
  return `${dateString}${this.licensePlate}`;
});

// Virtual for duration in days
bookingSchema.virtual('durationDays').get(function() {
  const durationMs = this.checkOutTime - this.checkInTime;
  return Math.ceil(durationMs / (1000 * 60 * 60 * 24));
});

// Virtual for is overdue
bookingSchema.virtual('isOverdue').get(function() {
  if (this.status === 'checked-in' && this.actualCheckOutTime) {
    return this.actualCheckOutTime > this.checkOutTime;
  }
  return this.status === 'checked-in' && new Date() > this.checkOutTime;
});

// Index for better query performance
bookingSchema.index({ user: 1 });
bookingSchema.index({ parkingType: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ checkInTime: 1 });
bookingSchema.index({ checkOutTime: 1 });
bookingSchema.index({ phone: 1 });
bookingSchema.index({ licensePlate: 1 });
bookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema); 