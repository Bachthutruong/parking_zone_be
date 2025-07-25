const mongoose = require('mongoose');

const discountCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Discount code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Discount name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
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
  maxDiscount: {
    type: Number,
    min: 0
  },
  minOrderAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  validFrom: {
    type: Date,
    required: [true, 'Valid from date is required']
  },
  validTo: {
    type: Date,
    required: [true, 'Valid to date is required']
  },
  maxUsage: {
    type: Number,
    default: -1, // -1 means unlimited
    min: -1
  },
  currentUsage: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableParkingTypes: [{
    type: String,
    enum: ['indoor', 'outdoor', 'disabled']
  }],
  applicableServices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AddonService'
  }],
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
  usageHistory: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    usedAt: {
      type: Date,
      default: Date.now
    },
    discountAmount: {
      type: Number,
      required: true
    }
  }]
}, {
  timestamps: true
});

// Virtual for is valid
discountCodeSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         now >= this.validFrom && 
         now <= this.validTo && 
         (this.maxUsage === -1 || this.currentUsage < this.maxUsage);
});

// Virtual for remaining usage
discountCodeSchema.virtual('remainingUsage').get(function() {
  return this.maxUsage === -1 ? 'unlimited' : Math.max(0, this.maxUsage - this.currentUsage);
});

// Method to check if user can use this code
discountCodeSchema.methods.canUserUse = function(user) {
  if (!this.isValid) return false;
  
  // Check VIP restriction
  if (this.userRestrictions.vipOnly && !user.isVIP) return false;
  
  // Check specific users restriction
  if (this.userRestrictions.specificUsers.length > 0) {
    if (!this.userRestrictions.specificUsers.includes(user._id)) return false;
  }
  
  // Check if user already used this code
  const hasUsed = this.usageHistory.some(usage => 
    usage.user.toString() === user._id.toString()
  );
  
  return !hasUsed;
};

// Method to apply discount
discountCodeSchema.methods.calculateDiscount = function(orderAmount) {
  if (orderAmount < this.minOrderAmount) return 0;
  
  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (orderAmount * this.discountValue) / 100;
  } else {
    discount = this.discountValue;
  }
  
  // Apply max discount limit
  if (this.maxDiscount && discount > this.maxDiscount) {
    discount = this.maxDiscount;
  }
  
  return Math.min(discount, orderAmount);
};

// Index for efficient queries
discountCodeSchema.index({ code: 1 });
discountCodeSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });

module.exports = mongoose.model('DiscountCode', discountCodeSchema); 