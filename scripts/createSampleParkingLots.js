const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const ParkingLot = require('../models/ParkingLot');

const sampleParkingLots = [
  {
    name: 'Bãi đậu xe trong nhà A',
    type: 'indoor',
    description: 'Bãi đậu xe trong nhà có mái che, an toàn và tiện lợi',
    location: 'Tầng hầm B1, Tòa nhà A',
    totalSpaces: 50,
    availableSpaces: 50,
    basePrice: 100,
    pricePerDay: 100,
    isActive: true,
    features: ['covered', 'security', 'camera', 'lighting']
  },
  {
    name: 'Bãi đậu xe trong nhà B',
    type: 'indoor',
    description: 'Bãi đậu xe trong nhà cao cấp với dịch vụ valet',
    location: 'Tầng hầm B2, Tòa nhà B',
    totalSpaces: 30,
    availableSpaces: 30,
    basePrice: 120,
    pricePerDay: 120,
    isActive: true,
    features: ['covered', 'security', 'camera', 'lighting']
  },
  {
    name: 'Bãi đậu xe ngoài trời chính',
    type: 'outdoor',
    description: 'Bãi đậu xe ngoài trời rộng rãi, dễ tiếp cận',
    location: 'Khu vực A, Sân bãi chính',
    totalSpaces: 100,
    availableSpaces: 100,
    basePrice: 80,
    pricePerDay: 80,
    isActive: true,
    features: ['lighting', 'accessible']
  },
  {
    name: 'Bãi đậu xe ngoài trời phụ',
    type: 'outdoor',
    description: 'Bãi đậu xe ngoài trời phụ, phù hợp cho xe nhỏ',
    location: 'Khu vực B, Sân bãi phụ',
    totalSpaces: 60,
    availableSpaces: 60,
    basePrice: 70,
    pricePerDay: 70,
    isActive: true,
    features: ['lighting', 'accessible']
  },
  {
    name: 'Bãi đậu xe dành cho người khuyết tật',
    type: 'disabled',
    description: 'Bãi đậu xe đặc biệt dành cho người khuyết tật',
    location: 'Khu vực ưu tiên, Gần lối vào chính',
    totalSpaces: 20,
    availableSpaces: 20,
    basePrice: 60,
    pricePerDay: 60,
    isActive: true,
    features: ['accessible', 'security', 'lighting']
  }
];

async function createSampleParkingLots() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check existing parking lots by type
    const existingLots = await ParkingLot.find();
    console.log('Existing parking lots:');
    existingLots.forEach(lot => {
      console.log(`- ${lot.name} (${lot.type}): ${lot.totalSpaces} spaces`);
    });

    // Create additional parking lots for missing types
    const existingTypes = existingLots.map(lot => lot.type);
    const lotsToCreate = sampleParkingLots.filter(lot => !existingTypes.includes(lot.type));

    if (lotsToCreate.length === 0) {
      console.log('All parking lot types already exist. Skipping creation.');
      return;
    }

    // Create parking lots
    const createdLots = await ParkingLot.insertMany(lotsToCreate);
    console.log('Additional parking lots created successfully');

    // Log the created lots
    console.log('Created parking lots:');
    createdLots.forEach(lot => {
      console.log(`- ${lot.name} (${lot.type}): ${lot.totalSpaces} spaces, ${lot.pricePerDay} TWD/day`);
    });

  } catch (error) {
    console.error('Error creating sample parking lots:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createSampleParkingLots(); 