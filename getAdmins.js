import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from './models/User.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const checkAdmins = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce_reseller');
  const admins = await User.find({ role: 'admin' }).select('email');
  console.log('Admins found:', admins);
  process.exit(0);
};

checkAdmins().catch(console.error);
