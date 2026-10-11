import { setServers } from 'node:dns';

export function mongoUri() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kbd_portfolio';
  if (
    !/^mongodb(?:\+srv)?:\/\//.test(uri) ||
    /<(?:db_username|db_password|username|password)>|YOUR_(?:DATABASE_)?(?:USERNAME|PASSWORD)/i.test(
      uri,
    )
  ) {
    const error = new Error(
      'Set MONGODB_URI to a valid MongoDB URL with your database credentials.',
    );
    error.name = 'ConfigurationError';
    throw error;
  }
  return uri;
}

export function mongoErrorMessage(error) {
  if (error.name === 'ConfigurationError') return error.message;
  if (error.code === 18 || error.codeName === 'AuthenticationFailed') {
    return 'MongoDB authentication failed. Check your database username, password, and password URL encoding.';
  }
  return `MongoDB connection failed (${error.name}). Check database availability, DNS, network access, and the Atlas IP access list.`;
}

export function configureMongoDns() {
  const servers = process.env.MONGODB_DNS_SERVERS?.split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  if (servers?.length) {
    try {
      setServers(servers);
    } catch {
      const error = new Error(
        'MONGODB_DNS_SERVERS must contain comma-separated DNS server IP addresses.',
      );
      error.name = 'ConfigurationError';
      throw error;
    }
  }
}
