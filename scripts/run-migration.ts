import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

function formatConnectionString(url: string): string {
  if (url.includes('sslmode=')) {
    return url.replace(/sslmode=[^&]+/, 'sslmode=verify-full');
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}sslmode=verify-full`;
}

async function migrateNode(
  nodeName: string,
  connectionUrl: string | undefined,
  sqlContent: string,
) {
  if (!connectionUrl) {
    console.warn(`⚠️ Skipping ${nodeName}: Connection URL is not set in .env`);
    return;
  }

  console.log(`⏳ Migrating database node: ${nodeName}...`);

  const client = new Client({
    connectionString: formatConnectionString(connectionUrl),
  });

  try {
    await client.connect();
    await client.query(sqlContent);
    console.log(`✅ Successfully applied schema to ${nodeName}`);
  } catch (error) {
    console.error(
      `❌ Failed to migrate ${nodeName}:`,
      (error as Error).message,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function runAllMigrations() {
  const sqlPath = join(process.cwd(), 'schema.sql');
  // Strip non-breaking spaces (\u00a0) and replace with standard ASCII spaces
  const rawSql = readFileSync(sqlPath, 'utf8');
  const sqlContent = rawSql.replace(/\u00a0/g, ' ');

  console.log('🚀 Starting schema migration across all database nodes...\n');

  await migrateNode('MAIN DB', process.env.NEONDB_MAIN_URL, sqlContent);
  await migrateNode('BACKUP DB', process.env.NEONDB_BACKUP_URL, sqlContent);

  console.log('\n🎉 Migration process completed.');
}

void runAllMigrations();