const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['email', 'sms', 'push'],
    required: [true, 'Template type is required']
  },
  subject: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Template content is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  variables: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
notificationTemplateSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema); 