const AutoDiscount = require('../models/AutoDiscount');
const ParkingType = require('../models/ParkingType');
const User = require('../models/User');

// Get all auto discounts
const getAllAutoDiscounts = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, search } = req.query;
    const query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const autoDiscounts = await AutoDiscount.find(query)
      .populate('applicableParkingTypes', 'name type')
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await AutoDiscount.countDocuments(query);
    
    res.json({
      success: true,
      data: autoDiscounts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error getting auto discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting auto discounts',
      error: error.message
    });
  }
};

// Get single auto discount
const getAutoDiscountById = async (req, res) => {
  try {
    const autoDiscount = await AutoDiscount.findById(req.params.id)
      .populate('applicableParkingTypes', 'name type pricePerDay')
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');
    
    if (!autoDiscount) {
      return res.status(404).json({
        success: false,
        message: 'Auto discount not found'
      });
    }
    
    res.json({
      success: true,
      data: autoDiscount
    });
  } catch (error) {
    console.error('Error getting auto discount:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting auto discount',
      error: error.message
    });
  }
};

// Create new auto discount
const createAutoDiscount = async (req, res) => {
  try {
    const {
      name,
      description,
      minDays,
      maxDays,
      applicableParkingTypes,
      discountType,
      discountValue,
      maxDiscountAmount,
      applyToSpecialPrices,
      validFrom,
      validTo,
      priority,
      maxUsage,
      userRestrictions,
      conditions
    } = req.body;
    
    // Validate required fields
    if (!name || !description || !minDays || !applicableParkingTypes || !discountType || !discountValue) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, description, minDays, applicableParkingTypes, discountType, discountValue'
      });
    }
    
    // Validate parking types exist
    const parkingTypes = await ParkingType.find({
      _id: { $in: applicableParkingTypes },
      isActive: true
    });
    
    if (parkingTypes.length !== applicableParkingTypes.length) {
      return res.status(400).json({
        success: false,
        message: 'Some parking types are invalid or inactive'
      });
    }
    
    // Validate dates
    const now = new Date();
    const validFromDate = new Date(validFrom);
    const validToDate = new Date(validTo);
    
    // Allow validFrom to be in the past (for immediate activation)
    if (validToDate <= validFromDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid to date must be after valid from date'
      });
    }
    
    // Validate minDays
    if (minDays < 1) {
      return res.status(400).json({
        success: false,
        message: 'Minimum days must be at least 1'
      });
    }
    
    // Validate maxDays if provided
    if (maxDays && maxDays < minDays) {
      return res.status(400).json({
        success: false,
        message: 'Maximum days must be greater than or equal to minimum days'
      });
    }
    
    // Validate discount value
    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount must be between 0 and 100'
      });
    }
    
    if (discountType === 'fixed' && discountValue < 0) {
      return res.status(400).json({
        success: false,
        message: 'Fixed discount must be positive'
      });
    }
    
    const autoDiscount = new AutoDiscount({
      name,
      description,
      minDays,
      maxDays,
      applicableParkingTypes,
      discountType,
      discountValue,
      maxDiscountAmount,
      applyToSpecialPrices,
      validFrom,
      validTo,
      priority: priority || 0,
      maxUsage: maxUsage || -1,
      userRestrictions: userRestrictions || {},
      conditions: conditions || {},
      createdBy: req.user.id
    });
    
    await autoDiscount.save();
    
    await autoDiscount.populate([
      { path: 'applicableParkingTypes', select: 'name type pricePerDay' },
      { path: 'createdBy', select: 'name email' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Auto discount created successfully',
      data: autoDiscount
    });
  } catch (error) {
    console.error('Error creating auto discount:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating auto discount',
      error: error.message
    });
  }
};

// Update auto discount
const updateAutoDiscount = async (req, res) => {
  try {
    const {
      name,
      description,
      minDays,
      maxDays,
      applicableParkingTypes,
      discountType,
      discountValue,
      maxDiscountAmount,
      applyToSpecialPrices,
      validFrom,
      validTo,
      priority,
      maxUsage,
      userRestrictions,
      conditions,
      isActive
    } = req.body;
    
    const autoDiscount = await AutoDiscount.findById(req.params.id);
    
    if (!autoDiscount) {
      return res.status(404).json({
        success: false,
        message: 'Auto discount not found'
      });
    }
    
    // Validate parking types if provided
    if (applicableParkingTypes) {
      const parkingTypes = await ParkingType.find({
        _id: { $in: applicableParkingTypes },
        isActive: true
      });
      
      if (parkingTypes.length !== applicableParkingTypes.length) {
        return res.status(400).json({
          success: false,
          message: 'Some parking types are invalid or inactive'
        });
      }
    }
    
    // Validate dates if provided
    if (validFrom && validTo) {
      const now = new Date();
      if (new Date(validFrom) < now) {
        return res.status(400).json({
          success: false,
          message: 'Valid from date cannot be in the past'
        });
      }
      
      if (new Date(validTo) <= new Date(validFrom)) {
        return res.status(400).json({
          success: false,
          message: 'Valid to date must be after valid from date'
        });
      }
    }
    
    // Validate discount value if provided
    if (discountType && discountValue !== undefined) {
      if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount must be between 0 and 100'
        });
      }
      
      if (discountType === 'fixed' && discountValue < 0) {
        return res.status(400).json({
          success: false,
          message: 'Fixed discount must be positive'
        });
      }
    }
    
    // Update fields
    const updateData = {
      lastModifiedBy: req.user.id
    };
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (minDays !== undefined) updateData.minDays = minDays;
    if (maxDays !== undefined) updateData.maxDays = maxDays;
    if (applicableParkingTypes !== undefined) updateData.applicableParkingTypes = applicableParkingTypes;
    if (discountType !== undefined) updateData.discountType = discountType;
    if (discountValue !== undefined) updateData.discountValue = discountValue;
    if (maxDiscountAmount !== undefined) updateData.maxDiscountAmount = maxDiscountAmount;
    if (applyToSpecialPrices !== undefined) updateData.applyToSpecialPrices = applyToSpecialPrices;
    if (validFrom !== undefined) updateData.validFrom = validFrom;
    if (validTo !== undefined) updateData.validTo = validTo;
    if (priority !== undefined) updateData.priority = priority;
    if (maxUsage !== undefined) updateData.maxUsage = maxUsage;
    if (userRestrictions !== undefined) updateData.userRestrictions = userRestrictions;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const updatedAutoDiscount = await AutoDiscount.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    await updatedAutoDiscount.populate([
      { path: 'applicableParkingTypes', select: 'name type pricePerDay' },
      { path: 'createdBy', select: 'name email' },
      { path: 'lastModifiedBy', select: 'name email' }
    ]);
    
    res.json({
      success: true,
      message: 'Auto discount updated successfully',
      data: updatedAutoDiscount
    });
  } catch (error) {
    console.error('Error updating auto discount:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating auto discount',
      error: error.message
    });
  }
};

// Delete auto discount
const deleteAutoDiscount = async (req, res) => {
  try {
    const autoDiscount = await AutoDiscount.findById(req.params.id);
    
    if (!autoDiscount) {
      return res.status(404).json({
        success: false,
        message: 'Auto discount not found'
      });
    }
    
    await AutoDiscount.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Auto discount deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting auto discount:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting auto discount',
      error: error.message
    });
  }
};

// Toggle auto discount status
const toggleAutoDiscountStatus = async (req, res) => {
  try {
    const autoDiscount = await AutoDiscount.findById(req.params.id);
    
    if (!autoDiscount) {
      return res.status(404).json({
        success: false,
        message: 'Auto discount not found'
      });
    }
    
    autoDiscount.isActive = !autoDiscount.isActive;
    autoDiscount.lastModifiedBy = req.user.id;
    await autoDiscount.save();
    
    res.json({
      success: true,
      message: `Auto discount ${autoDiscount.isActive ? 'activated' : 'deactivated'} successfully`,
      data: autoDiscount
    });
  } catch (error) {
    console.error('Error toggling auto discount status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling auto discount status',
      error: error.message
    });
  }
};

// Get applicable auto discounts for booking
const getApplicableAutoDiscounts = async (req, res) => {
  try {
    const { parkingTypeId, checkInTime, checkOutTime, totalAmount, isVIP, userId } = req.query;
    
    if (!parkingTypeId || !checkInTime || !checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    const bookingData = {
      parkingTypeId,
      checkInTime,
      checkOutTime,
      totalAmount: parseFloat(totalAmount) || 0,
      isVIP: isVIP === 'true',
      userId
    };
    
    // Get all active auto discounts
    const autoDiscounts = await AutoDiscount.find({
      isActive: true,
      applicableParkingTypes: parkingTypeId,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() }
    }).populate('applicableParkingTypes', 'name type');
    
    // Filter applicable discounts
    const applicableDiscounts = autoDiscounts.filter(discount => 
      discount.appliesToBooking(bookingData)
    );
    
    // Sort by priority (highest first)
    applicableDiscounts.sort((a, b) => b.priority - a.priority);
    
    // Calculate discount amounts
    const discountsWithAmounts = applicableDiscounts.map(discount => ({
      _id: discount._id,
      name: discount.name,
      description: discount.description,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      maxDiscountAmount: discount.maxDiscountAmount,
      applyToSpecialPrices: discount.applyToSpecialPrices,
      discountAmount: discount.calculateDiscount(bookingData),
      priority: discount.priority
    }));
    
    res.json({
      success: true,
      data: discountsWithAmounts
    });
  } catch (error) {
    console.error('Error getting applicable auto discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting applicable auto discounts',
      error: error.message
    });
  }
};

// Get auto discount statistics
const getAutoDiscountStats = async (req, res) => {
  try {
    const stats = await AutoDiscount.aggregate([
      {
        $group: {
          _id: null,
          totalDiscounts: { $sum: 1 },
          activeDiscounts: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          totalUsage: { $sum: '$usageCount' },
          avgPriority: { $avg: '$priority' }
        }
      }
    ]);
    
    const typeStats = await AutoDiscount.aggregate([
      {
        $group: {
          _id: '$discountType',
          count: { $sum: 1 },
          totalUsage: { $sum: '$usageCount' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalDiscounts: 0,
          activeDiscounts: 0,
          totalUsage: 0,
          avgPriority: 0
        },
        byType: typeStats
      }
    });
  } catch (error) {
    console.error('Error getting auto discount stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting auto discount stats',
      error: error.message
    });
  }
};

module.exports = {
  getAllAutoDiscounts,
  getAutoDiscountById,
  createAutoDiscount,
  updateAutoDiscount,
  deleteAutoDiscount,
  toggleAutoDiscountStatus,
  getApplicableAutoDiscounts,
  getAutoDiscountStats
};
