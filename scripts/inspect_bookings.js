const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
// Models must be registered
const ParkingType = require('../models/ParkingType');
const AddonService = require('../models/AddonService');

require('dotenv').config({ path: 'backend/.env' });

const inspectBookings = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('✅ Connected to MongoDB');

    // Find bookings around Jan 15, 2026
    const startRange = new Date('2026-01-15T00:00:00');
    const endRange = new Date('2026-01-15T23:59:59');

    const bookings = await Booking.find({
        licensePlate: 'BGS-0113'
    }).populate('parkingType').populate('addonServices.service');

    console.log(`\nFound ${bookings.length} bookings in Jan 2026.`);

    // Filter for the specific times
    const targetBookings = bookings.filter(b => {
        // loose match on minutes
        const minutes = b.checkInTime.getMinutes();
        const hours = b.checkInTime.getHours(); // Local to server
        // Convert to look like screenshot if possible
        // Just dump them
        return true;
    });

    targetBookings.forEach(b => {
        console.log(`\n--------------------------------------------------`);
        console.log(`Booking Number: ${b.bookingNumber}`);
        console.log(`ID: ${b._id}`);
        console.log(`Check In: ${b.checkInTime.toISOString()} (Local: ${b.checkInTime.toLocaleString()})`);
        console.log(`Check Out: ${b.checkOutTime.toISOString()}`);
        console.log(`Total Amount: ${b.totalAmount}`);
        console.log(`Final Amount: ${b.finalAmount}`);
        console.log(`Parking Type: ${b.parkingType ? b.parkingType.name : 'Unknown'} (Price: ${b.parkingType ? b.parkingType.pricePerDay : '?'})`);
        
        console.log(`Luggage Count: ${b.luggageCount}`);
        
        console.log(`Addons:`);
        b.addonServices.forEach(a => console.log(` - ${a.name}: ${a.price}`));
        
        console.log(`VIP Discount: ${b.vipDiscount}`);
        console.log(`Auto Discount: ${JSON.stringify(b.autoDiscount)}`);
        
        // Manual Validation
        // Base Price = Days * PricePerDay
        // Diff = Total - Base
        // Check if Diff == Luggage (100 * (Luggage-1))
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

inspectBookings();
