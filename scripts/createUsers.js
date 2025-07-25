const mongoose = require('mongoose');
const User = require('../models/User');
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

// Create admin user
const createAdminUser = async () => {
  try {
    const adminData = {
      name: 'Admin Manager',
      email: 'admin@parkingzone.com',
      phone: '0901234567',
      password: 'admin123456',
      role: 'admin',
      isActive: true,
      referralCode: 'ADMIN001',
      notes: 'Tài khoản quản trị viên chính'
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return existingAdmin;
    }

    const admin = new User(adminData);
    await admin.save();
    console.log('✅ Admin user created successfully:');
    console.log('   Email:', admin.email);
    console.log('   Password: admin123456');
    console.log('   Role: Admin');
    return admin;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
};

// Create staff user
const createStaffUser = async () => {
  try {
    const staffData = {
      name: 'Staff Member',
      email: 'staff@parkingzone.com',
      phone: '0901234568',
      password: 'staff123456',
      role: 'staff',
      isActive: true,
      referralCode: 'STAFF001',
      notes: 'Tài khoản nhân viên'
    };

    // Check if staff already exists
    const existingStaff = await User.findOne({ email: staffData.email });
    if (existingStaff) {
      console.log('Staff user already exists:', existingStaff.email);
      return existingStaff;
    }

    const staff = new User(staffData);
    await staff.save();
    console.log('✅ Staff user created successfully:');
    console.log('   Email:', staff.email);
    console.log('   Password: staff123456');
    console.log('   Role: Staff');
    return staff;
  } catch (error) {
    console.error('Error creating staff user:', error);
    throw error;
  }
};

// Create test user
const createTestUser = async () => {
  try {
    const userData = {
      name: 'Test User',
      email: 'user@parkingzone.com',
      phone: '0901234569',
      password: 'user123456',
      role: 'user',
      isActive: true,
      licensePlate: 'ABC-123',
      address: '123 Test Street, Test City',
      referralCode: 'USER001',
      notes: 'Tài khoản khách hàng test'
    };

    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      console.log('Test user already exists:', existingUser.email);
      return existingUser;
    }

    const user = new User(userData);
    await user.save();
    console.log('✅ Test user created successfully:');
    console.log('   Email:', user.email);
    console.log('   Password: user123456');
    console.log('   Role: User');
    return user;
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
};

// Main function
const main = async () => {
  try {
    console.log('🚀 Starting user creation script...\n');
    
    await connectDB();
    
    console.log('📝 Creating users...\n');
    
    // Create admin user
    await createAdminUser();
    console.log('');
    
    // Create staff user
    await createStaffUser();
    console.log('');
    
    // Create test user
    await createTestUser();
    console.log('');
    
    console.log('🎉 All users created successfully!');
    console.log('\n📋 Summary of created accounts:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 Admin Account:');
    console.log('   Email: admin@parkingzone.com');
    console.log('   Password: admin123456');
    console.log('   Role: Admin (Full access)');
    console.log('');
    console.log('👨‍💼 Staff Account:');
    console.log('   Email: staff@parkingzone.com');
    console.log('   Password: staff123456');
    console.log('   Role: Staff (Limited admin access)');
    console.log('');
    console.log('👤 Test User Account:');
    console.log('   Email: user@parkingzone.com');
    console.log('   Password: user123456');
    console.log('   Role: User (Customer access)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
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