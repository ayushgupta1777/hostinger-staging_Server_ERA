import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  const tokens = users.filter(u => u.fcmToken).map(u => u.fcmToken);
  console.log('Total users:', users.length);
  console.log('Users with fcmToken:', tokens.length);
  console.log('Tokens:', tokens);
  process.exit(0);
}

run().catch(console.error);
