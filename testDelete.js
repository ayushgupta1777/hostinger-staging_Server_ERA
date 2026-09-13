import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from './models/User.js';
import Address from './models/Address.js';
import Order from './models/Order.js';
import { deleteAccount } from './controllers/userController.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const runTest = async () => {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce_reseller');
  console.log('Connected.');

  console.log('\n--- Test 1: Deletion without Orders ---');
  const user = new User({
    name: 'Test Delete User',
    email: 'testdelete@example.com',
    password: 'password123',
    phone: '1234567890',
    isActive: true
  });
  await user.save();

  const address = new Address({
    user: user._id,
    name: 'Test Address',
    phone: '1234567890',
    street: '123 Main St',
    city: 'Test City',
    state: 'Test State',
    pincode: '123456'
  });
  await address.save();

  let nextCalledWith = null;
  let responseData = null;
  const mockReq = { user: { id: user._id } };
  const mockRes = { json: (data) => { responseData = data; } };
  const mockNext = (err) => { nextCalledWith = err; };

  await deleteAccount(mockReq, mockRes, mockNext);

  const checkUser = await User.findById(user._id);
  const checkAddress = await Address.findOne({ user: user._id });

  console.log('API Response:', responseData);
  console.log('Errors:', nextCalledWith);
  console.log('User after deletion:', checkUser ? 'EXISTS' : 'DELETED');
  console.log('Address after deletion:', checkAddress ? 'EXISTS' : 'DELETED');

  console.log('\n--- Test 2: Deletion with Orders (Anonymization) ---');
  const user2 = new User({
    name: 'Test Order User',
    email: 'testorder@example.com',
    password: 'password123',
    phone: '9876543210',
    isActive: true
  });
  await user2.save();

  const order = new Order({
    user: user2._id,
    orderNo: 'TEST-ORD-123',
    items: [],
    shippingAddress: address.toObject(),
    subtotal: 100,
    shippingAmount: 50,
    total: 150,
    paymentMethod: 'cod',
    paymentStatus: 'pending'
  });
  await order.save();

  mockReq.user.id = user2._id;
  await deleteAccount(mockReq, mockRes, mockNext);

  const checkUser2 = await User.findById(user2._id);
  console.log('API Response:', responseData);
  console.log('User Exists?', checkUser2 ? 'YES' : 'NO');
  if(checkUser2) {
      console.log('Name:', checkUser2.name);
      console.log('Email:', checkUser2.email);
      console.log('Phone:', checkUser2.phone);
      console.log('Password:', checkUser2.password);
      console.log('IsActive:', checkUser2.isActive);
  }

  await Order.deleteMany({ _id: order._id });
  await User.deleteMany({ _id: user2._id });
  process.exit(0);
};

runTest().catch(console.error);
