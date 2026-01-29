/**
 * Script để sửa lỗi unique index cho email field
 * 
 * Vấn đề: Email field có unique index nhưng không có sparse: true
 * khi index được tạo ban đầu. Điều này gây ra lỗi duplicate key 
 * khi nhiều user có email = null.
 * 
 * Giải pháp: Drop index cũ và tạo lại với sparse: true
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function fixEmailIndex() {
  try {
    // Kết nối MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const collection = mongoose.connection.db.collection('users');

    // Kiểm tra các indexes hiện tại
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Tìm và xóa email index cũ
    const emailIndex = indexes.find(idx => idx.key && idx.key.email !== undefined);
    
    if (emailIndex) {
      console.log(`\n🗑️ Dropping old email index: ${emailIndex.name}`);
      try {
        await collection.dropIndex(emailIndex.name);
        console.log('✅ Old email index dropped successfully');
      } catch (dropError) {
        console.log('⚠️ Error dropping index:', dropError.message);
      }
    } else {
      console.log('\n⚠️ No email index found');
    }

    // Tạo lại email index với sparse: true
    console.log('\n🔨 Creating new email index with sparse: true...');
    try {
      await collection.createIndex(
        { email: 1 },
        { 
          unique: true, 
          sparse: true,
          name: 'email_1_sparse'
        }
      );
      console.log('✅ New sparse email index created successfully');
    } catch (createError) {
      console.log('⚠️ Error creating index:', createError.message);
    }

    // Xác minh indexes mới
    console.log('\n📋 Updated indexes:');
    const newIndexes = await collection.indexes();
    console.log(JSON.stringify(newIndexes, null, 2));

    // Đếm số users có email null
    const nullEmailCount = await collection.countDocuments({ email: null });
    const undefinedEmailCount = await collection.countDocuments({ email: { $exists: false } });
    console.log(`\n📊 Users statistics:`);
    console.log(`   - Users with email = null: ${nullEmailCount}`);
    console.log(`   - Users without email field: ${undefinedEmailCount}`);

    console.log('\n✅ Email index fix completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixEmailIndex();
