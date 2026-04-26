/**
 * Backfill parkingSlotNumbers for bookings with status checked-in but empty slots.
 * Assigns lowest free numbers 1..totalSpaces per lot, in order of actualCheckInTime then createdAt.
 *
 * Usage (from backend folder):
 *   node scripts/backfillParkingSlotNumbers.js
 * Or: MONGODB_URI="mongodb+srv://..." node scripts/backfillParkingSlotNumbers.js
 */
const fs = require('fs');
const path = require('path');
const envFile = path.join(__dirname, '../.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const ParkingType = require('../models/ParkingType');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone';
  await mongoose.connect(uri);
  console.log('✅ Connected');

  const types = await ParkingType.find({}).sort({ name: 1 }).lean();
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const pt of types) {
    const checkedIn = await Booking.find({
      parkingType: pt._id,
      status: 'checked-in',
      isDeleted: { $ne: true },
    })
      .sort({ actualCheckInTime: 1, createdAt: 1 })
      .lean();

    const used = new Set();
    for (const b of checkedIn) {
      const arr = Array.isArray(b.parkingSlotNumbers) && b.parkingSlotNumbers.length
        ? b.parkingSlotNumbers
        : [];
      for (const s of arr) {
        if (s >= 1 && s <= pt.totalSpaces) used.add(s);
      }
    }

    for (const b of checkedIn) {
      const has = Array.isArray(b.parkingSlotNumbers) && b.parkingSlotNumbers.length > 0;
      if (has) continue;

      const vc = Math.max(1, b.vehicleCount || 1);
      const picked = [];
      for (let n = 1; n <= pt.totalSpaces && picked.length < vc; n += 1) {
        if (!used.has(n)) {
          picked.push(n);
          used.add(n);
        }
      }
      if (picked.length < vc) {
        console.warn(
          `⚠️  [${pt.name}] 無法分配 ${vc} 格 for ${b.licensePlate} (${b._id}) — 剩餘空位不足`
        );
        totalSkipped += 1;
        continue;
      }

      await Booking.updateOne({ _id: b._id }, { $set: { parkingSlotNumbers: picked } });
      console.log(`✅ [${pt.name}] ${b.licensePlate} → [${picked.join(', ')}]`);
      totalUpdated += 1;
    }
  }

  console.log(`\n📊 完成：已寫入 ${totalUpdated} 筆，跳過 ${totalSkipped} 筆（車位不足）`);
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
