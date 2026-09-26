import mongoose from 'mongoose';
const uri = 'mongodb://HSSE:Ecom_HSSE_HostPass16@localhost:27017/ecommerce_reseller?authSource=admin';

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to MongoDB successfully!');
    const db = mongoose.connection.db;
    const usersWithTokens = await db.collection('users').find({ fcmToken: { $exists: true, $ne: null } }).toArray();
    
    console.log('Users with tokens found:', usersWithTokens.length);
    if(usersWithTokens.length > 0) {
      console.log('Sample token:', usersWithTokens[0].fcmToken, 'Email:', usersWithTokens[0].email, 'Phone:', usersWithTokens[0].phone);
    } else {
      console.log('No users found with an FCM token in this database.');
    }
    process.exit(0);
  })
  .catch(e => {
    console.error('Connection error:', e.message);
    process.exit(1);
  });
