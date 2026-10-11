import app from './app.js';
import { initStore, storageMode } from './store.js';
import { mongoErrorMessage } from './mongo-config.js';

try {
  await initStore();
  app.listen(process.env.PORT || 4000, '0.0.0.0', () =>
    console.log(`Portfolio API ready at http://localhost:${process.env.PORT || 4000}`),
  );
} catch (error) {
  console.error(
    storageMode === 'mongodb'
      ? mongoErrorMessage(error)
      : `Cannot initialize file storage (${error.name}). Check your storage settings.`,
  );
  process.exit(1);
}
