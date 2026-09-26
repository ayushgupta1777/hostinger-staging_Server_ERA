import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/test');
  const collections = await mongoose.connection.db.collections();
  let found = false;
  for (let c of collections) {
    const items = await c.find({ fcmToken: { $exists: true, $ne: null } }).toArray();
    if (items.length > 0) {
      found = true;
      console.log(`Found ${items.length} tokens in collection ${c.collectionName}:`);
      items.forEach(i => console.log(i.fcmToken));
    }
  }
  if (!found) console.log("No fcmTokens found in any collection in 'test' db.");
  process.exit(0);
}

run().catch(console.error);
