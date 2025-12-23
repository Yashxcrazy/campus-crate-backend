// Backfill missing user roles to 'user'.
// Usage: MONGODB_URI="..." node scripts/backfillRoles.js

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  console.log('Connected. Backfilling missing roles...');
  const result = await User.updateMany(
    { $or: [{ role: { $exists: false } }, { role: null }] },
    { $set: { role: 'user' } }
  );
  console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}.`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
