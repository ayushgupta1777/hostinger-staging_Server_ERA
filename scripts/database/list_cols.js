import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/ecommerce_reseller');
  const collections = await mongoose.connection.db.collections();
  console.log(collections.map(c=>c.collectionName));
  process.exit(0);
}

run().catch(console.error);
