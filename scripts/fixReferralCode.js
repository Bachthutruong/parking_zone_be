const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Fix referralCode issue
const fixReferralCode = async () => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection('users');
    
    console.log('🔍 Checking existing users with null referralCode...');
    
    // Find users with null referralCode
    const usersWithNullReferral = await collection.find({ referralCode: null }).toArray();
    console.log(`Found ${usersWithNullReferral.length} users with null referralCode`);
    
    if (usersWithNullReferral.length > 0) {
      console.log('📝 Updating users with null referralCode...');
      
      // Update each user with a unique referralCode
      for (let i = 0; i < usersWithNullReferral.length; i++) {
        const user = usersWithNullReferral[i];
        const uniqueReferralCode = `USER_${Date.now()}_${i}`;
        
        await collection.updateOne(
          { _id: user._id },
          { $set: { referralCode: uniqueReferralCode } }
        );
        
        console.log(`Updated user ${user.email || user._id} with referralCode: ${uniqueReferralCode}`);
      }
    }
    
    console.log('✅ ReferralCode issue fixed successfully!');
    
  } catch (error) {
    console.error('Error fixing referralCode:', error);
    throw error;
  }
};

// Drop the unique index on referralCode if it exists
const dropReferralCodeIndex = async () => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection('users');
    
    console.log('🔍 Checking for referralCode index...');
    
    const indexes = await collection.indexes();
    const referralCodeIndex = indexes.find(index => 
      index.key && index.key.referralCode === 1
    );
    
    if (referralCodeIndex) {
      console.log('🗑️ Dropping unique index on referralCode...');
      await collection.dropIndex('referralCode_1');
      console.log('✅ ReferralCode index dropped successfully!');
    } else {
      console.log('ℹ️ No referralCode index found');
    }
    
  } catch (error) {
    console.error('Error dropping referralCode index:', error);
    // Continue even if there's an error
  }
};

// Main function
const main = async () => {
  try {
    console.log('🚀 Starting referralCode fix script...\n');
    
    await connectDB();
    
    // First, drop the problematic index
    await dropReferralCodeIndex();
    console.log('');
    
    // Then fix the referralCode values
    await fixReferralCode();
    console.log('');
    
    console.log('🎉 ReferralCode fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error in main function:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
main(); 