// src/database/database.service.ts
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

  // READ from duplicate (existing)
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

  // READ from main (for critical consistency)
  async executeReadMain<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const mainUrl = process.env.NEONDB_MAIN_URL;
    if (!mainUrl) throw new Error('Main DB URL is not configured');
    const client = await this.getClient(mainUrl);
    try {
      const { rows } = await client.query<T>(queryText, params);
      return rows;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  // DUAL-WRITE (main + duplicate)
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
      this.logger.error('Failed dual-write:', (error as Error).message);
      throw error;
    } finally {
      await Promise.all([
        mainClient.end().catch(() => undefined),
        duplicateClient.end().catch(() => undefined),
      ]);
    }
  }

  // DUAL-WRITE with RETURNING (main + duplicate)
  async executeWriteReturning<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const mainUrl = process.env.NEONDB_MAIN_URL;
    const duplicateUrl = process.env.NEONDB_DUPLICATE_URL;
    if (!mainUrl || !duplicateUrl) {
      throw new Error('Main or Duplicate DB URL is not configured');
    }
    const mainClient = await this.getClient(mainUrl);
    const duplicateClient = await this.getClient(duplicateUrl);
    try {
      const [mainResult] = await Promise.all([
        mainClient.query<T>(queryText, params),
        duplicateClient.query<T>(queryText, params),
      ]);
      return mainResult.rows;
    } catch (error) {
      this.logger.error(
        'Failed dual-write with RETURNING:',
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
