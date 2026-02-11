const ParkingType = require('../models/ParkingType');
const Booking = require('../models/Booking');
const cloudinary = require('cloudinary').v2;

// Get all parking types
exports.getAllParkingTypes = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    
    const query = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const parkingTypes = await ParkingType.find(query)
      .sort({ createdAt: -1 });

    // For general listing, show total capacity (not time-specific availability)
    const parkingTypesWithCapacity = parkingTypes.map((parkingType) => {
      return {
        ...parkingType.toObject(),
        availableSpaces: parkingType.totalSpaces // Show full capacity for general listing
      };
    });

    res.json({ parkingTypes: parkingTypesWithCapacity });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Helper: count occupied spaces = SUM(vehicleCount) of overlapping active bookings (exclude cancelled/deleted)
function buildAvailabilityMatch(parkingTypeId, startOfRange, endOfRange) {
  return {
    parkingType: parkingTypeId,
    status: { $in: ['pending', 'confirmed', 'checked-in'] },
    isDeleted: { $ne: true },
    $or: [
      { checkInTime: { $lt: endOfRange }, checkOutTime: { $gt: startOfRange } }
    ]
  };
}

const TAIWAN_TZ = 'Asia/Taipei';
function toTaiwanDateStr(d) {
  return d.toLocaleDateString('en-CA', { timeZone: TAIWAN_TZ });
}

// Get today's availability for all parking types (for sidebar display)
// Uses Taiwan date to match calendar view on admin/bookings
exports.getTodayAvailability = async (req, res) => {
  try {
    const now = new Date();
    const dateStr = toTaiwanDateStr(now);
    const startOfDay = new Date(`${dateStr}T00:00:00.000+08:00`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999+08:00`);

    const parkingTypes = await ParkingType.find({ isActive: true }).sort({ name: 1 });
    const result = [];

    for (const pt of parkingTypes) {
      const agg = await Booking.aggregate([
        { $match: buildAvailabilityMatch(pt._id, startOfDay, endOfDay) },
        { $group: { _id: null, totalVehicles: { $sum: { $ifNull: ['$vehicleCount', 1] } } } }
      ]);
      const occupiedSpaces = agg.length > 0 ? agg[0].totalVehicles : 0;
      const availableSpaces = Math.max(0, pt.totalSpaces - occupiedSpaces);
      result.push({
        id: pt._id,
        name: pt.name,
        totalSpaces: pt.totalSpaces,
        availableSpaces,
        occupiedSpaces
      });
    }

    res.json({ date: dateStr, parking: result });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Get parking type by ID
exports.getParkingTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const parkingType = await ParkingType.findById(id);
    if (!parkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    res.json({ parkingType });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Get parking type availability for a specific date
exports.getParkingTypeAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    const parkingType = await ParkingType.findById(id);
    if (!parkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    if (!date) {
      return res.status(400).json({ message: '請提供日期' });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const agg = await Booking.aggregate([
      { $match: buildAvailabilityMatch(parkingType._id, startOfDay, endOfDay) },
      { $group: { _id: null, totalVehicles: { $sum: { $ifNull: ['$vehicleCount', 1] } } } }
    ]);
    const occupiedSpaces = agg.length > 0 ? agg[0].totalVehicles : 0;
    const availableSpaces = Math.max(0, parkingType.totalSpaces - occupiedSpaces);

    res.json({
      parkingTypeId: parkingType._id,
      date: date,
      totalSpaces: parkingType.totalSpaces,
      availableSpaces,
      occupiedSpaces,
      isAvailable: availableSpaces > 0
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Get parking type availability for a month
exports.getParkingTypeMonthAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { year, month } = req.query;

    const parkingType = await ParkingType.findById(id);
    if (!parkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    if (!year || !month) {
      return res.status(400).json({ message: '請提供年份或月份' });
    }

    const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

    const monthBookings = await Booking.find({
      parkingType: parkingType._id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
      isDeleted: { $ne: true },
      $or: [
        { checkInTime: { $lt: endOfMonth }, checkOutTime: { $gt: startOfMonth } }
      ]
    }).select('checkInTime checkOutTime vehicleCount').lean();

    const daysInMonth = endOfMonth.getDate();
    const availabilityData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(parseInt(year), parseInt(month) - 1, day);
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const occupiedSpaces = monthBookings
        .filter(b => b.checkInTime < endOfDay && b.checkOutTime > startOfDay)
        .reduce((sum, b) => sum + (b.vehicleCount || 1), 0);

      const availableSpaces = Math.max(0, parkingType.totalSpaces - occupiedSpaces);
      const isInPast = currentDate < new Date();

      availabilityData.push({
        date: currentDate.toISOString().split('T')[0],
        isAvailable: !isInPast && availableSpaces > 0,
        availableSpaces: isInPast ? 0 : availableSpaces,
        occupiedSpaces,
        totalSpaces: parkingType.totalSpaces,
        price: parkingType.pricePerDay,
        isInPast
      });
    }

    res.json({
      parkingTypeId: parkingType._id,
      year: parseInt(year),
      month: parseInt(month),
      availabilityData
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Create parking type
exports.createParkingType = async (req, res) => {
  try {
    const {
      name,
      type,
      totalSpaces,
      basePrice,
      pricePerDay,
      description,
      location,
      features,
      operatingHours
    } = req.body;

    const parkingType = await ParkingType.create({
      name,
      type,
      totalSpaces,
      availableSpaces: totalSpaces,
      basePrice,
      pricePerDay,
      description,
      location,
      features,
      operatingHours
    });

    res.status(201).json({
      message: '建立停車類型成功',
      parkingType
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Update parking type
exports.updateParkingType = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Get current parking type to calculate used spaces
    const currentParkingType = await ParkingType.findById(id);
    if (!currentParkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    // Handle totalSpaces and availableSpaces updates to prevent negative availableSpaces
    if (updateData.totalSpaces !== undefined || updateData.availableSpaces !== undefined) {
      const currentTotalSpaces = currentParkingType.totalSpaces;
      const currentAvailableSpaces = currentParkingType.availableSpaces;
      const usedSpaces = currentTotalSpaces - currentAvailableSpaces;
      
      const newTotalSpaces = updateData.totalSpaces !== undefined 
        ? Number(updateData.totalSpaces) 
        : currentTotalSpaces;
      
      // If totalSpaces is being updated, recalculate availableSpaces
      if (updateData.totalSpaces !== undefined) {
        // Calculate new available spaces based on used spaces
        // Ensure it's never negative
        updateData.availableSpaces = Math.max(0, newTotalSpaces - usedSpaces);
      } else if (updateData.availableSpaces !== undefined) {
        // If only availableSpaces is being updated, validate it
        const newAvailableSpaces = Number(updateData.availableSpaces);
        // Ensure availableSpaces is between 0 and totalSpaces
        updateData.availableSpaces = Math.max(0, Math.min(newAvailableSpaces, newTotalSpaces));
      }
      
      // Final validation: ensure availableSpaces doesn't exceed totalSpaces
      if (updateData.availableSpaces > newTotalSpaces) {
        updateData.availableSpaces = newTotalSpaces;
      }
    }

    const parkingType = await ParkingType.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: '停車類型更新成功',
      parkingType
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Delete parking type
exports.deleteParkingType = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are active bookings
    const activeBookings = await Booking.find({
      parkingType: id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({ 
        message: '無法刪除有進行中預約的停車類型' 
      });
    }

    const parkingType = await ParkingType.findByIdAndDelete(id);
    if (!parkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    res.json({ message: '刪除停車類型成功' });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Create parking lot
exports.createParkingLot = async (req, res) => {
  try {
    const {
      name,
      type,
      totalSpaces,
      basePrice,
      pricePerDay,
      description,
      location,
      features,
      operatingHours
    } = req.body;

    const parkingLot = await ParkingLot.create({
      name,
      type,
      totalSpaces,
      availableSpaces: totalSpaces,
      basePrice,
      pricePerDay,
      description,
      location,
      features,
      operatingHours
    });

    res.status(201).json({
      message: '建立停車場成功',
      parkingLot
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Update parking lot
exports.updateParkingLot = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const parkingLot = await ParkingLot.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!parkingLot) {
      return res.status(404).json({ message: '找不到停車場' });
    }

    res.json({
      message: '停車場更新成功',
      parkingLot
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Delete parking lot
exports.deleteParkingLot = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are active bookings
    const activeBookings = await Booking.find({
      parkingLot: id,
      status: { $in: ['pending', 'confirmed', 'checked-in'] }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({ 
        message: '無法刪除有進行中預約的停車場' 
      });
    }

    const parkingLot = await ParkingLot.findByIdAndDelete(id);
    if (!parkingLot) {
      return res.status(404).json({ message: '找不到停車場' });
    }

    res.json({ message: '刪除停車場成功' });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Add special price
exports.addSpecialPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, price, reason } = req.body;

    const parkingLot = await ParkingLot.findById(id);
    if (!parkingLot) {
      return res.status(404).json({ message: '找不到停車場' });
    }

    // Check if special price already exists for this date
    const existingPrice = parkingLot.specialPrices.find(
      sp => sp.date.toDateString() === new Date(date).toDateString()
    );

    if (existingPrice) {
      existingPrice.price = price;
      existingPrice.reason = reason;
    } else {
      parkingLot.specialPrices.push({ date, price, reason });
    }

    await parkingLot.save();

    res.json({
      message: '新增特殊價格成功',
      parkingLot
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Remove special price
exports.removeSpecialPrice = async (req, res) => {
  try {
    const { id, priceId } = req.params;

    const parkingLot = await ParkingLot.findById(id);
    if (!parkingLot) {
      return res.status(404).json({ message: '找不到停車場' });
    }

    parkingLot.specialPrices = parkingLot.specialPrices.filter(
      sp => sp._id.toString() !== priceId
    );

    await parkingLot.save();

    res.json({
      message: '刪除特殊價格成功',
      parkingLot
    });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Upload images for parking type
exports.uploadImages = async (req, res) => {
  try {
    const { id } = req.params;
    const { processedImages } = req;

    if (!processedImages || processedImages.length === 0) {
      return res.status(400).json({ message: '未上傳任何圖片' });
    }

    const parkingType = await ParkingType.findById(id);
    if (!parkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    // Store original availableSpaces to prevent validation error
    const originalAvailableSpaces = parkingType.availableSpaces;

    // Add new images to existing ones
    parkingType.images = [...(parkingType.images || []), ...processedImages];
    
    // Ensure availableSpaces is not negative
    if (parkingType.availableSpaces < 0) {
      parkingType.availableSpaces = Math.max(0, originalAvailableSpaces);
    }
    
    await parkingType.save();

    res.json({
      message: '圖片上傳成功',
      images: processedImages,
      totalImages: parkingType.images.length
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Delete image from parking type
exports.deleteImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    const parkingType = await ParkingType.findById(id);
    if (!parkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    const imageIndex = parkingType.images.findIndex(img => img._id.toString() === imageId);
    if (imageIndex === -1) {
      return res.status(404).json({ message: '找不到圖片' });
    }

    const image = parkingType.images[imageIndex];
    
    // Store original availableSpaces to prevent validation error
    const originalAvailableSpaces = parkingType.availableSpaces;
    
    // Delete from Cloudinary
    try {
      if (image.cloudinaryId) {
        await cloudinary.uploader.destroy(image.cloudinaryId);
      }
      if (image.thumbnailCloudinaryId) {
        await cloudinary.uploader.destroy(image.thumbnailCloudinaryId);
      }
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Remove from database
    parkingType.images.splice(imageIndex, 1);
    
    // Ensure availableSpaces is not negative
    if (parkingType.availableSpaces < 0) {
      parkingType.availableSpaces = Math.max(0, originalAvailableSpaces);
    }
    
    await parkingType.save();

    res.json({
      message: '刪除圖片成功',
      remainingImages: parkingType.images.length
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// Update image order/status
exports.updateImageOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageIds } = req.body; // Array of image IDs in new order

    const parkingType = await ParkingType.findById(id);
    if (!parkingType) {
      return res.status(404).json({ message: '找不到停車類型' });
    }

    // Store original availableSpaces to prevent validation error
    const originalAvailableSpaces = parkingType.availableSpaces;

    // Reorder images based on provided order
    const reorderedImages = [];
    for (const imageId of imageIds) {
      const image = parkingType.images.find(img => img._id.toString() === imageId);
      if (image) {
        reorderedImages.push(image);
      }
    }

    parkingType.images = reorderedImages;
    
    // Ensure availableSpaces is not negative
    if (parkingType.availableSpaces < 0) {
      parkingType.availableSpaces = Math.max(0, originalAvailableSpaces);
    }
    
    await parkingType.save();

    res.json({
      message: '圖片順序更新成功',
      images: parkingType.images
    });
  } catch (error) {
    console.error('Update image order error:', error);
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};



module.exports = exports; 