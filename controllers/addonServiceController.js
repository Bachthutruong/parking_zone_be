const AddonService = require('../models/AddonService');

// Get all addon services
exports.getAllAddonServices = async (req, res) => {
  try {
    const { category, isActive } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const services = await AddonService.find(query)
      .sort({ sortOrder: 1, createdAt: -1 });

    res.json({ services });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get addon service by ID
exports.getAddonServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await AddonService.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    }

    res.json({ service });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Create addon service
exports.createAddonService = async (req, res) => {
  try {
    const {
      name,
      description,
      icon,
      price,
      isFree,
      category,
      requiresAdvanceBooking,
      advanceBookingHours,
      maxQuantity,
      availability,
      terms,
      sortOrder
    } = req.body;

    const service = await AddonService.create({
      name,
      description,
      icon,
      price: isFree ? 0 : price,
      isFree,
      category,
      requiresAdvanceBooking,
      advanceBookingHours,
      maxQuantity,
      availability,
      terms,
      sortOrder
    });

    res.status(201).json({
      message: 'Tạo dịch vụ bổ sung thành công',
      service
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update addon service
exports.updateAddonService = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const service = await AddonService.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!service) {
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    }

    res.json({
      message: 'Cập nhật dịch vụ bổ sung thành công',
      service
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Delete addon service
exports.deleteAddonService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await AddonService.findByIdAndDelete(id);
    if (!service) {
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    }

    res.json({ message: 'Xóa dịch vụ bổ sung thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Toggle service active status
exports.toggleServiceStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await AddonService.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    }

    service.isActive = !service.isActive;
    await service.save();

    res.json({
      message: `${service.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} dịch vụ thành công`,
      service
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Get services by category
exports.getServicesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const services = await AddonService.find({
      category,
      isActive: true
    }).sort({ sortOrder: 1 });

    res.json({ services });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Initialize default services
exports.initializeDefaultServices = async (req, res) => {
  try {
    const defaultServices = AddonService.getDefaultServices();
    
    const createdServices = [];
    for (const serviceData of defaultServices) {
      const existingService = await AddonService.findOne({ name: serviceData.name });
      if (!existingService) {
        const service = await AddonService.create(serviceData);
        createdServices.push(service);
      }
    }

    res.json({
      message: 'Khởi tạo dịch vụ mặc định thành công',
      createdServices,
      totalCreated: createdServices.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Update service order
exports.updateServiceOrder = async (req, res) => {
  try {
    const { services } = req.body; // Array of { id, sortOrder }

    for (const serviceData of services) {
      await AddonService.findByIdAndUpdate(serviceData.id, {
        sortOrder: serviceData.sortOrder
      });
    }

    res.json({ message: 'Cập nhật thứ tự dịch vụ thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

module.exports = exports; 