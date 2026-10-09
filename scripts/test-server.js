import { createServer } from 'vite';
import '../server/index.js';

// Run both test services in one process so Windows teardown has no child process tree.
const vite = await createServer({ server: { host: '127.0.0.1' } });
await vite.listen();
