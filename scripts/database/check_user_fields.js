import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/ecommerce_reseller');
  const u = await mongoose.connection.db.collection('users').findOne({});
  console.log(u ? Object.keys(u) : "No users");
  process.exit(0);
}

run().catch(console.error);
