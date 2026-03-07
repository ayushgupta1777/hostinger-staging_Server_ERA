import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const initializeFirebase = () => {
    try {
        const serviceAccountPath = join(__dirname, 'firebase-service-account.json');

        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin SDK Initialized');
        } else {
            console.warn('⚠️ Firebase service account file not found. Firebase Auth verification will be disabled.');
        }
    } catch (error) {
        console.error('❌ Firebase initialization error:', error.message);
    }
};

export { admin, initializeFirebase };
