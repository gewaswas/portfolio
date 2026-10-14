import { createServer } from 'node:http';
import handler from '../api/index.js';

const server = createServer(handler).listen(0, '127.0.0.1', () => {
  console.log(`TEST_PORT=${server.address().port}`);
});
