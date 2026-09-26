import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const notifications = await mongoose.connection.db.collection('notifications').find({}).toArray();
  console.log('Total notifications:', notifications.length);
  
  // Find notifications with failures maybe? Or just print out anything related to 3 failed notifications
  const failed = notifications.filter(n => n.status && n.status.push && n.status.push.error);
  console.log('Failed notifications:', JSON.stringify(failed, null, 2));

  // Check if any fcmToken exists in any document in the entire db?
  // Let's just find exactly 3 tokens somewhere.
  process.exit(0);
}

run().catch(console.error);
