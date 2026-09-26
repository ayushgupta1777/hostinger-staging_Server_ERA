import fetch from 'node-fetch';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

async function runTest() {
  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}/api`;

  const userId = '6995fb3d97de269f29ea20c3'; // Asg test account
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });

  // Simulate FCM token from installed app
  const fcmTokenFromApp = 'fcm_test_token_from_device_999888777';

  console.log(`Hitting PUT /api/users/fcm-token with token: ${fcmTokenFromApp}...`);
  
  const putRes = await fetch(`${baseUrl}/users/fcm-token`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ fcmToken: fcmTokenFromApp })
  });

  const putData = await putRes.json();
  console.log('Endpoint response:', putData);

  console.log('Verifying in MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce_reseller');
  const dbUser = await mongoose.connection.db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userId) });
  
  if (dbUser && dbUser.fcmToken === fcmTokenFromApp) {
    console.log('✅ SUCCESS: The FCM token was successfully saved in the MongoDB users collection!');
    console.log('User fcmToken field in DB:', dbUser.fcmToken);
  } else {
    console.log('❌ FAILURE: Token was NOT saved in the database.');
    if (dbUser) {
        console.log('Current fcmToken in DB:', dbUser.fcmToken);
    }
  }

  process.exit(0);
}

runTest().catch(console.error);
