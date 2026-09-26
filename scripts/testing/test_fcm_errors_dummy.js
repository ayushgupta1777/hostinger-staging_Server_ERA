import dotenv from 'dotenv';
dotenv.config();

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
    console.error('Service account not found');
    process.exit(1);
  }
} catch (error) {
  console.error('Firebase Admin initialization failed:', error.message);
  process.exit(1);
}

async function runTest() {
  // Creating tokens that simulate typical failures
  const tokens = [
    // 1. Completely invalid string format
    "invalid_token", 
    // 2. Properly formatted FCM token but not registered (dummy characters)
    "eXqZ8w...:APA91bH_" + "A".repeat(130),
    // 3. Just an empty string or another invalid token
    "test_token_3"
  ];

  const payload = {
    notification: { title: 'Test', body: 'Capturing exact Firebase errors' },
    tokens: tokens
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(payload);
    
    console.log(`Success: ${response.successCount}, Failure: ${response.failureCount}`);
    
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.log(`Token ${idx} Failed:`);
          console.log(`  Token: ${tokens[idx]}`);
          console.log(`  Error Code: ${resp.error.code}`);
          console.log(`  Error Message: ${resp.error.message}`);
        }
      });
    }
  } catch (error) {
    console.error('Error during send:', error);
  }
  process.exit(0);
}

runTest();
