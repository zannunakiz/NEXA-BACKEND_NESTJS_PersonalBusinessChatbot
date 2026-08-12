"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = require("fs");
const path_1 = require("path");
const pg_1 = require("pg");
function formatConnectionString(url) {
    if (url.includes('sslmode=')) {
        return url.replace(/sslmode=[^&]+/, 'sslmode=verify-full');
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sslmode=verify-full`;
}
async function migrateNode(nodeName, connectionUrl, sqlContent) {
    if (!connectionUrl) {
        console.warn(`⚠️ Skipping ${nodeName}: Connection URL is not set in .env`);
        return;
    }
    console.log(`⏳ Migrating database node: ${nodeName}...`);
    const client = new pg_1.Client({
        connectionString: formatConnectionString(connectionUrl),
    });
    try {
        await client.connect();
        await client.query(sqlContent);
        console.log(`✅ Successfully applied schema to ${nodeName}`);
    }
    catch (error) {
        console.error(`❌ Failed to migrate ${nodeName}:`, error.message);
    }
    finally {
        await client.end().catch(() => undefined);
    }
}
async function runAllMigrations() {
    const sqlPath = (0, path_1.join)(process.cwd(), 'schema.sql');
    const rawSql = (0, fs_1.readFileSync)(sqlPath, 'utf8');
    const sqlContent = rawSql.replace(/\u00a0/g, ' ');
    console.log('🚀 Starting schema migration across all database nodes...\n');
    await migrateNode('MAIN DB', process.env.NEONDB_MAIN_URL, sqlContent);
    await migrateNode('BACKUP DB', process.env.NEONDB_BACKUP_URL, sqlContent);
    console.log('\n🎉 Migration process completed.');
}
void runAllMigrations();
//# sourceMappingURL=run-migration.js.map