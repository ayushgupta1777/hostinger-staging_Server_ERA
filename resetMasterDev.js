import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from './models/User.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const resetMasterDev = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce_reseller');
  
  let developer = await User.findOne({ email: 'developer@system.local' });
  if (developer) {
    developer.password = 'master123';
    await developer.save();
    console.log('Password updated successfully for developer@system.local');
  } else {
    console.log('Account developer@system.local not found');
  }
  process.exit(0);
};

resetMasterDev().catch(console.error);
