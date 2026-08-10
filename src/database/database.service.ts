import { Injectable, Logger } from '@nestjs/common';
import { Client, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  async getClient(connectionUrl: string): Promise<Client> {
    if (!connectionUrl) {
      throw new Error('Database connection URL is undefined');
    }

    const client = new Client({
      connectionString: connectionUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    return client;
  }

  async ping(connectionUrl: string): Promise<boolean> {
    if (!connectionUrl) {
      throw new Error('Connection URL is undefined');
    }

    const client = await this.getClient(connectionUrl);

    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  async executeRead<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const duplicateUrl = process.env.NEONDB_DUPLICATE_URL;
    if (!duplicateUrl) {
      throw new Error('Duplicate DB URL is not configured');
    }

    const client = await this.getClient(duplicateUrl);

    try {
      const { rows } = await client.query<T>(queryText, params);
      return rows;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  async executeWrite(queryText: string, params: unknown[] = []): Promise<void> {
    const mainUrl = process.env.NEONDB_MAIN_URL;
    const duplicateUrl = process.env.NEONDB_DUPLICATE_URL;

    if (!mainUrl || !duplicateUrl) {
      throw new Error('Main or Duplicate DB URL is not configured');
    }

    const mainClient = await this.getClient(mainUrl);
    const duplicateClient = await this.getClient(duplicateUrl);

    try {
      await Promise.all([
        mainClient.query(queryText, params),
        duplicateClient.query(queryText, params),
      ]);
    } catch (error) {
      this.logger.error(
        'Failed dual-write transaction:',
        (error as Error).message,
      );
      throw error;
    } finally {
      await Promise.all([
        mainClient.end().catch(() => undefined),
        duplicateClient.end().catch(() => undefined),
      ]);
    }
  }
}
