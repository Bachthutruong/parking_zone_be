const mongoose = require('mongoose');
const SystemSettings = require('../models/SystemSettings');
require('dotenv').config();

async function addMinBookingDays() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find all SystemSettings documents
    const settings = await SystemSettings.find({});
    console.log(`Found ${settings.length} SystemSettings documents`);

    // Update each document to add minBookingDays field
    for (const setting of settings) {
      if (setting.minBookingDays === undefined) {
        setting.minBookingDays = 3; // Default value
        await setting.save();
        console.log(`Updated SystemSettings document ${setting._id} with minBookingDays: 3`);
      } else {
        console.log(`SystemSettings document ${setting._id} already has minBookingDays: ${setting.minBookingDays}`);
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
addMinBookingDays(); 