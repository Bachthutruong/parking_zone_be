#!/usr/bin/env node

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone';

// Admin user data
const adminUser = {
  name: 'Admin',
  email: 'admin@test.com',
  password: 'admin123',
  role: 'admin',
  isActive: true,
  isVIP: false,
  vipDiscount: 0
};

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);    
    console.log('✅ Connected to MongoDB');

    // Import User model
    const User = require('./models/User');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: adminUser.email });
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   Active: ${existingAdmin.isActive}`);
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminUser.password, saltRounds);

    // Create admin user
    const newAdmin = new User({
      ...adminUser,
      password: hashedPassword
    });

    await newAdmin.save();
    console.log('✅ Admin user created successfully');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: ${adminUser.password}`);
    console.log(`   Role: ${adminUser.role}`);

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('📦 MongoDB connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser }; 