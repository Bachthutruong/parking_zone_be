const mongoose = require('mongoose');

const termsSchema = new mongoose.Schema({
  section: {
    type: String,
    required: [true, 'Section name is required'],
    enum: [
      'bookingTerms',
      'bookingRules', 
      'privacyPolicy',
      'contactInfo',
      'timeSlotInterval',
      'cancellationPolicy',
      'refundPolicy'
    ],
    unique: true
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
termsSchema.index({ section: 1 });

module.exports = mongoose.model('Terms', termsSchema); 