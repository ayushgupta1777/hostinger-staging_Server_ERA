import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
try {
  const serviceAccountPath = path.resolve(__dirname, './config/firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized successfully');
    }
  } else {
    console.warn('Firebase Admin service account not found at config/firebase-service-account.json');
    process.exit(1);
  }
} catch (error) {
  console.error('Firebase Admin initialization failed:', error.message);
  process.exit(1);
}

// User Schema minimally to get tokens
const userSchema = new mongoose.Schema({
  fcmToken: String
}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

async function runTest() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    console.log('Connecting to MongoDB...', mongoUri ? 'URI found' : 'URI missing');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const usersWithTokens = await User.find({ fcmToken: { $exists: true, $ne: null, $not: /^\\s*$/ } }).select('fcmToken');
    const tokens = usersWithTokens.map(u => u.fcmToken);
    
    console.log(`Found ${tokens.length} users with tokens.`);
    if (tokens.length === 0) {
      console.log('No tokens found.');
      process.exit(0);
    }

    const payload = {
      notification: { title: 'Test Notification', body: 'Checking errors...' },
      tokens: tokens
    };

    console.log('Sending multicast...');
    const response = await admin.messaging().sendEachForMulticast(payload);
    
    console.log(`Success: ${response.successCount}, Failure: ${response.failureCount}`);
    
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Token [${idx}]: ${tokens[idx]}`);
          console.error(`  Error Code: ${resp.error.code}`);
          console.error(`  Error Message: ${resp.error.message}`);
        }
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

runTest();
