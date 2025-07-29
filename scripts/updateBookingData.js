const mongoose = require('mongoose');
const Booking = require('../models/Booking');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Update booking data with new logic
const updateBookingData = async () => {
  try {
    console.log('🔄 Starting booking data update...');
    
    // 1. Update all pending bookings to confirmed status
    const pendingBookings = await Booking.find({ status: 'pending' });
    console.log(`📝 Found ${pendingBookings.length} pending bookings to update`);
    
    if (pendingBookings.length > 0) {
      const updateResult = await Booking.updateMany(
        { status: 'pending' },
        { status: 'confirmed' }
      );
      console.log(`✅ Updated ${updateResult.modifiedCount} bookings from pending to confirmed`);
    }

    // 2. Update bookingNumber for all bookings (this will be done by virtual, but let's verify)
    const allBookings = await Booking.find({}).sort({ createdAt: -1 }).limit(10);
    console.log(`📊 Sample of updated bookings:`);
    
    for (const booking of allBookings) {
      const oldNumber = `BK${booking._id.toString().slice(-6).toUpperCase()}`;
      const newNumber = booking.bookingNumber;
      console.log(`  Booking ID: ${booking._id}`);
      console.log(`  Old Number: ${oldNumber}`);
      console.log(`  New Number: ${newNumber}`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  License Plate: ${booking.licensePlate}`);
      console.log(`  Created: ${booking.createdAt}`);
      console.log('  ---');
    }

    // 3. Test creating a new booking to verify new logic
    console.log('🧪 Testing new booking creation...');
    
    // Find a parking type to use for test
    const ParkingType = require('../models/ParkingType');
    const parkingType = await ParkingType.findOne({ isActive: true });
    
    if (!parkingType) {
      console.log('⚠️  No active parking type found, skipping test booking creation');
    } else {
      // Create a test booking
      const testBooking = await Booking.create({
        user: new mongoose.Types.ObjectId(), // Temporary user ID
        parkingType: parkingType._id,
        checkInTime: new Date(),
        checkOutTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day later
        driverName: 'Test Driver',
        phone: '0900000000',
        email: 'test@example.com',
        licensePlate: 'TEST-1234',
        passengerCount: 1,
        luggageCount: 0,
        totalAmount: 1000,
        discountAmount: 0,
        finalAmount: 1000,
        paymentStatus: 'pending',
        paymentMethod: 'cash'
      });

      console.log('✅ Test booking created successfully:');
      console.log(`  Booking ID: ${testBooking._id}`);
      console.log(`  Booking Number: ${testBooking.bookingNumber}`);
      console.log(`  Status: ${testBooking.status}`);
      console.log(`  License Plate: ${testBooking.licensePlate}`);
      console.log(`  Created: ${testBooking.createdAt}`);

      // Clean up test booking
      await Booking.findByIdAndDelete(testBooking._id);
      console.log('🧹 Test booking cleaned up');
    }

    console.log('🎉 Booking data update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating booking data:', error);
  }
};

// Test API endpoints
const testAPIEndpoints = async () => {
  try {
    console.log('🧪 Testing API endpoints...');
    
    const axios = require('axios');
    const baseURL = 'http://localhost:5002/api';

    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health endpoint:', healthResponse.data.status);

    // Test parking types endpoint
    console.log('2. Testing parking types endpoint...');
    const parkingResponse = await axios.get(`${baseURL}/parking`);
    console.log('✅ Parking types endpoint:', parkingResponse.data.parkingTypes.length, 'types found');

    // Test bookings endpoint (if accessible)
    console.log('3. Testing bookings endpoint...');
    try {
      const bookingsResponse = await axios.get(`${baseURL}/bookings/search?phone=0900000000`);
      console.log('✅ Bookings search endpoint:', bookingsResponse.data.bookings.length, 'bookings found');
    } catch (error) {
      console.log('⚠️  Bookings endpoint requires authentication or no data found');
    }

    console.log('🎉 API endpoint tests completed!');
    
  } catch (error) {
    console.error('❌ Error testing API endpoints:', error.message);
  }
};

// Main execution
const main = async () => {
  console.log('🚀 Starting Booking Data Update Script');
  console.log('=====================================');
  
  await connectDB();
  await updateBookingData();
  await testAPIEndpoints();
  
  console.log('=====================================');
  console.log('✅ Script completed successfully!');
  
  // Close database connection
  await mongoose.connection.close();
  console.log('📦 Database connection closed');
};

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { updateBookingData, testAPIEndpoints }; 