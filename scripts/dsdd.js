import { createServer } from 'vite';
import '../server/index.js';

const vite = await createServer({ server: { host: '127.0.0.1' } });
await vite.listen();
