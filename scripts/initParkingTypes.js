const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const ParkingType = require('../models/ParkingType');

const parkingTypes = [
  {
    name: 'Bãi đậu xe trong nhà',
    type: 'indoor',
    description: 'Bãi đậu xe trong nhà có mái che, an toàn và giám sát 24/7',
    icon: '🏢',
    color: '#3B82F6',
    isActive: true,
    totalSpaces: 50,
    availableSpaces: 50,
    basePrice: 100,
    pricePerDay: 100,
    location: 'Tầng hầm B1',
    features: ['covered', 'security', 'camera', 'lighting'],
    operatingHours: {
      open: '00:00',
      close: '23:59'
    }
  },
  {
    name: 'Bãi đậu xe ngoài trời',
    type: 'outdoor',
    description: 'Bãi đậu xe ngoài trời rộng rãi, dễ tiếp cận',
    icon: '☀️',
    color: '#10B981',
    isActive: true,
    totalSpaces: 100,
    availableSpaces: 100,
    basePrice: 80,
    pricePerDay: 80,
    location: 'Khu vực A',
    features: ['lighting', 'accessible'],
    operatingHours: {
      open: '00:00',
      close: '23:59'
    }
  },
  {
    name: 'Khu vực dành cho người khuyết tật',
    type: 'disabled',
    description: 'Bãi đậu xe dành riêng cho người khuyết tật với thiết kế đặc biệt',
    icon: '♿',
    color: '#F59E0B',
    isActive: true,
    totalSpaces: 20,
    availableSpaces: 20,
    basePrice: 60,
    pricePerDay: 60,
    location: 'Khu vực ưu tiên',
    features: ['accessible', 'security'],
    operatingHours: {
      open: '00:00',
      close: '23:59'
    }
  }
];

async function initParkingTypes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing parking types
    await ParkingType.deleteMany({});
    console.log('Cleared existing parking types');

    // Create new parking types
    const createdTypes = await ParkingType.insertMany(parkingTypes);
    console.log('Parking types initialized successfully');

    // Log the created types
    console.log('Created parking types:');
    createdTypes.forEach(type => {
      console.log(`- ${type.name} (${type.type}): ${type.description}`);
      console.log(`  Spaces: ${type.totalSpaces}, Price: ${type.pricePerDay}/day`);
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