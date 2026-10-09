import { setServers } from 'node:dns';

export function configureMongoDns() {
  const servers = process.env.MONGODB_DNS_SERVERS?.split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  if (servers?.length) setServers(servers);
}
