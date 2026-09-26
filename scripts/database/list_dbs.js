import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/');
  const admin = mongoose.connection.db.admin();
  const dbs = await admin.listDatabases();
  console.log(dbs.databases.map(d=>d.name));
  process.exit(0);
}

run().catch(console.error);
