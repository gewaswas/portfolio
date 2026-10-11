import 'dotenv/config';
import mongoose from 'mongoose';
import { configureMongoDns, mongoUri, mongoErrorMessage } from '../server/mongo-config.js';
import { contentSchema } from '../shared/content.js';

function configurationError(message) {
  const error = new Error(message);
  error.name = 'ConfigurationError';
  return error;
}

// Driver server selection timeouts do not bound the initial Atlas DNS lookup.
const deadline = setTimeout(() => {
  console.error(
    'MongoDB check timed out after 20 seconds. Check DNS resolvers, network access, and the Atlas IP access list.',
  );
  process.exit(1);
}, 20000);
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
  await mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 10000 });
  const ping = await mongoose.connection.db.admin().ping({ timeoutMS: 3000 });
  const portfolio = await mongoose.connection.db
    .collection('portfolios')
    .findOne({ _id: 'portfolio' }, { timeoutMS: 3000 });
  if (ping.ok !== 1) throw new Error('Database ping failed.');
  console.log(`MongoDB connection: ${ping.ok === 1 ? 'OK' : 'failed'}`);
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Saved portfolio: ${portfolio ? 'found' : 'not created yet'}`);
  if (portfolio) {
    contentSchema.parse(portfolio.content);
    if (!Number.isSafeInteger(portfolio.revision) || portfolio.revision < 1) {
      throw configurationError('The saved portfolio revision is invalid. Restore a valid backup.');
    }
    console.log('Saved portfolio validation: OK');
  }
} catch (error) {
  if (error.code) console.error(`Connection error code: ${error.code}`);
  if (error.syscall) console.error(`Connection operation: ${error.syscall}`);
  console.error(
    error.name === 'ZodError'
      ? 'Saved portfolio content is invalid. Restore a valid backup.'
      : mongoErrorMessage(error),
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  clearTimeout(deadline);
}
