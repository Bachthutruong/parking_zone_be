const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
  phone: { 
    type: String, 
    trim: true,
    index: true 
  },
  licensePlate: { 
    type: String, 
    trim: true, 
    uppercase: true,
    index: true 
  },
  reason: { 
    type: String, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

// Note: at least one of phone or licensePlate must be provided, which we can enforce in controller

module.exports = mongoose.model('Blacklist', blacklistSchema);
