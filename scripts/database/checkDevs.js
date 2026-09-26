import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from './models/User.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const checkDevs = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce_reseller');
  const devs = await User.find({ role: 'developer' }).select('email name');
  console.log('Developers found:', devs);
  process.exit(0);
};

checkDevs().catch(console.error);
