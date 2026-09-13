import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from './models/User.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const createDeveloper = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce_reseller');
  
  let developer = await User.findOne({ email: 'developer@example.com' });
  if (developer) {
    developer.password = 'developer123';
    developer.role = 'developer';
    await developer.save();
    console.log('Password updated for developer@example.com');
  } else {
    developer = new User({
      name: 'Super Developer',
      email: 'developer@example.com',
      password: 'developer123',
      phone: '1111111111',
      role: 'developer',
      isActive: true,
      emailVerified: true
    });
    await developer.save();
    console.log('Developer account created: developer@example.com');
  }
  process.exit(0);
};

createDeveloper().catch(console.error);
