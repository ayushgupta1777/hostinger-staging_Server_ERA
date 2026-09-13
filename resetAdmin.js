import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from './models/User.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const resetAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce_reseller');
  
  let admin = await User.findOne({ email: 'admin@example.com' });
  if (admin) {
    admin.password = 'admin123';
    await admin.save();
    console.log('Password updated for admin@example.com');
  } else {
    admin = new User({
      name: 'Admin Developer',
      email: 'admin@example.com',
      password: 'admin123',
      phone: '0000000000',
      role: 'admin',
      isActive: true,
      emailVerified: true
    });
    await admin.save();
    console.log('Admin account created: admin@example.com');
  }
  process.exit(0);
};

resetAdmin().catch(console.error);
