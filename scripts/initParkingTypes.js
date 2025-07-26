const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const SystemSettings = require('../models/SystemSettings');

const parkingTypes = [
  {
    name: 'Trong nhà',
    type: 'indoor',
    description: 'Bãi đậu xe trong nhà có mái che',
    icon: '🏢',
    color: '#3B82F6',
    isActive: true,
    basePrice: 100,
    maxSpots: 50,
    features: ['Mái che', 'An toàn', 'Giám sát 24/7']
  },
  {
    name: 'Ngoài trời',
    type: 'outdoor',
    description: 'Bãi đậu xe ngoài trời',
    icon: '☀️',
    color: '#10B981',
    isActive: true,
    basePrice: 80,
    maxSpots: 100,
    features: ['Rộng rãi', 'Dễ tiếp cận', 'Giá rẻ']
  },
  {
    name: 'Khu vực dành cho người khuyết tật',
    type: 'disabled',
    description: 'Bãi đậu xe dành riêng cho người khuyết tật',
    icon: '♿',
    color: '#F59E0B',
    isActive: true,
    basePrice: 60,
    maxSpots: 20,
    features: ['Thiết kế đặc biệt', 'Dễ tiếp cận', 'Ưu tiên']
  }
];

async function initParkingTypes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get or create system settings
    let systemSettings = await SystemSettings.findOne();
    if (!systemSettings) {
      systemSettings = new SystemSettings({
        parkingLotTypes: parkingTypes
      });
    } else {
      // Update existing parking types
      systemSettings.parkingLotTypes = parkingTypes;
    }

    await systemSettings.save();
    console.log('Parking types initialized successfully');

    // Log the created types
    console.log('Created parking types:');
    parkingTypes.forEach(type => {
      console.log(`- ${type.name} (${type.type}): ${type.description}`);
    });

  } catch (error) {
    console.error('Error initializing parking types:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
initParkingTypes(); 