import 'dotenv/config';
import mongoose from 'mongoose';
import { configureMongoDns } from '../server/mongo-config.js';

function configurationError(message) {
  const error = new Error(message);
  error.name = 'ConfigurationError';
  return error;
}

try {
  if (!process.env.MONGODB_URI) {
    throw configurationError('Add MONGODB_URI to .env before checking the database.');
  }
  if (
    /<(?:db_username|db_password|username|password)>|YOUR_(?:DATABASE_)?(?:USERNAME|PASSWORD)/i.test(
      process.env.MONGODB_URI,
    )
  ) {
    throw configurationError(
      'Replace the username and password placeholders in MONGODB_URI in .env with your Atlas database credentials.',
    );
  }
  configureMongoDns();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const ping = await mongoose.connection.db.admin().ping();
  const portfolio = await mongoose.connection.db
    .collection('portfolios')
    .findOne({ _id: 'portfolio' }, { projection: { _id: 1 } });
  console.log(`MongoDB connection: ${ping.ok === 1 ? 'OK' : 'failed'}`);
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Saved portfolio: ${portfolio ? 'found' : 'not created yet'}`);
} catch (error) {
  if (error.name === 'ConfigurationError') console.error(error.message);
  else if (error.code === 18 || error.codeName === 'AuthenticationFailed') {
    console.error(
      'MongoDB authentication failed. Check your database username, password, and password URL encoding.',
    );
  } else {
    if (error.code) console.error(`Connection error code: ${error.code}`);
    if (error.syscall) console.error(`Connection operation: ${error.syscall}`);
    console.error(
      `MongoDB connection failed (${error.name}). Check the Atlas hostname, your IP access list, and database credentials.`,
    );
  }
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
