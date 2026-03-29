import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const seedDeveloper = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    const User = (await import('./models/User.js')).default;

    // Check if developer already exists
    let dev = await User.findOne({ email: 'developer@system.local' });
    
    if (dev) {
      console.log('Developer already exists!');
    } else {
      console.log('Creating developer account...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Root!Access2026', salt);
      
      dev = new User({
        name: 'MASTER SYSTEM',
        email: 'developer@system.local',
        password: hashedPassword,
        role: 'developer',
        isActive: true,
        emailVerified: true
      });
      // Skip the pre-save hook since we hashed manually due to how the script imports
      await dev.save({ validateBeforeSave: false });
      console.log('Developer account created successfully!');
    }
    
    console.log('-----------------------------------');
    console.log('DEVERLOPER CREDENTIALS:');
    console.log('Email: developer@system.local');
    console.log('Password: Root!Access2026');
    console.log('-----------------------------------');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding developer:', error);
    process.exit(1);
  }
};

seedDeveloper();
