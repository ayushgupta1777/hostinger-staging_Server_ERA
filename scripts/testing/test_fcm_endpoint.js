import fetch from 'node-fetch';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function runTest() {
  const PORT = 5000;
  const baseUrl = `http://localhost:${PORT}/api`;

  console.log('1. Logging in as Rahul Electronics (9876543210 / vendor123)...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rahul@electronics.com', password: 'vendor123' })
  });

  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('Login failed:', loginData);
    process.exit(1);
  }

  const token = loginData.token;
  console.log('Login successful. JWT obtained.');

  const fcmTokenFromApp = 'fcm_token_from_installed_app_12345';
  console.log(`2. Hitting PUT /api/users/fcm-token with token: ${fcmTokenFromApp}...`);
  
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

  console.log('3. Verifying in MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce_reseller');
  const dbUser = await mongoose.connection.db.collection('users').findOne({ email: 'rahul@electronics.com' });
  
  if (dbUser && dbUser.fcmToken === fcmTokenFromApp) {
    console.log('✅ SUCCESS: Token is actually saved in the MongoDB users collection!');
    console.log('User fcmToken field in DB:', dbUser.fcmToken);
  } else {
    console.log('❌ FAILURE: Token was NOT saved in the database.');
    console.log('User document from DB:', dbUser);
  }

  process.exit(0);
}

runTest().catch(console.error);
