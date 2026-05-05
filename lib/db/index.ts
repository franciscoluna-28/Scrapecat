import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Create libsql client
const client = createClient({
  url: 'file:commits-ai.db',
});

export const db = drizzle(client, { schema });

// Export all schema items for convenience
export { schema };
export * from './schema';
