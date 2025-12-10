const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI required in env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');

  const res = await User.updateMany({ role: { $exists: false } }, { $set: { role: 'user' } });
  console.log('Updated users without role:', res.modifiedCount);

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const r2 = await User.updateOne({ email: adminEmail }, { $set: { role: 'admin' } });
    console.log(`Promoted ${adminEmail} to admin:`, r2.modifiedCount);
  } else {
    console.log('No ADMIN_EMAIL provided; no admin created');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => { console.error(err); process.exit(1); });
