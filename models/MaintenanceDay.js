const mongoose = require('mongoose');

const maintenanceDaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Maintenance date is required'],
    unique: true
  },
  reason: {
    type: String,
    required: [true, 'Maintenance reason is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  affectedParkingTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingType'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance (removed duplicate date index)
maintenanceDaySchema.index({ isActive: 1 });
maintenanceDaySchema.index({ affectedParkingTypes: 1 });

// Method to check if a date is maintenance day
maintenanceDaySchema.statics.isMaintenanceDay = async function(date) {
  const maintenanceDay = await this.findOne({
    date: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    },
    isActive: true
  });
  return !!maintenanceDay;
};

// Method to get maintenance days for a date range
maintenanceDaySchema.statics.getMaintenanceDaysForRange = async function(startDate, endDate) {
  return await this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    },
    isActive: true
  }).populate('affectedParkingTypes', 'name code');
};

module.exports = mongoose.model('MaintenanceDay', maintenanceDaySchema); 