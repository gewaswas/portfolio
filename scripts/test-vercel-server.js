import { createServer } from 'node:http';
import handler from '../api/index.js';

// Exercise the same exported handler Vercel invokes, without the local startup runner.
const server = createServer(handler).listen(0, '127.0.0.1', () => {
  console.log(`TEST_PORT=${server.address().port}`);
});
