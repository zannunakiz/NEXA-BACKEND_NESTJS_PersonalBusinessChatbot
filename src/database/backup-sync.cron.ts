import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import cluster from 'node:cluster';
import { Client, QueryResult } from 'pg';
import { DatabaseService } from './database.service';

interface TableNameRow {
  table_name: string;
}

interface CountRow {
  count: string;
}

@Injectable()
export class BackupSyncCron {
  private readonly logger = new Logger(BackupSyncCron.name);

  constructor(private readonly databaseService: DatabaseService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleBackupSync(): Promise<void> {
    const workerId =
      process.env.NODE_UNIQUE_ID ??
      (cluster.worker?.id !== undefined
        ? String(cluster.worker.id)
        : undefined);

    if (
      cluster.isWorker &&
      workerId !== undefined &&
      workerId !== '0' &&
      workerId !== '1'
    ) {
      return;
    }

    const mainUrl = process.env.NEONDB_MAIN_URL;
    const backupUrl = process.env.NEONDB_BACKUP_URL;

    if (!mainUrl || !backupUrl) {
      this.logger.warn(
        '⚠️ Main DB or Backup DB URL missing in environment variables. Skipping sync.',
      );
      return;
    }

    this.logger.log(
      `🔄 [CRON] Starting Backup Synchronization on Worker PID: ${process.pid} (Worker ID: ${workerId ?? 'Standalone'})...`,
    );

    let mainClient: Client | undefined;
    try {
      mainClient = await this.databaseService.getClient(mainUrl);
    } catch (clientErr) {
      this.logger.error(
        '❌ Failed to connect to Main Database:',
        clientErr instanceof Error ? clientErr.message : String(clientErr),
      );
      return;
    }

    try {
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name != '_prisma_migrations';
      `;

      const tablesResult: QueryResult<TableNameRow> =
        await mainClient.query<TableNameRow>(tablesQuery);
      const tableNames = tablesResult.rows.map((r) => r.table_name);

      if (tableNames.length === 0) {
        this.logger.warn(
          '⚠️ No tables found in Main DB. Skipping backup sync.',
        );
        return;
      }

      let totalRowsInMain = 0;
      for (const table of tableNames) {
        const countResult: QueryResult<CountRow> =
          await mainClient.query<CountRow>(
            `SELECT COUNT(*)::text as count FROM "${table}"`,
          );
        totalRowsInMain += parseInt(countResult.rows[0]?.count || '0', 10);
      }

      if (totalRowsInMain === 0) {
        this.logger.error(
          '🚨 [CRITICAL ALERT] Main DB total rows is 0! Potential wipe or fatal error detected. SKIP SYNC to protect Backup DB.',
        );
        return;
      }

      let backupClient: Client | undefined;
      try {
        backupClient = await this.databaseService.getClient(backupUrl);
      } catch (backupConnErr) {
        this.logger.error(
          '❌ Failed to connect to Backup Database:',
          backupConnErr instanceof Error
            ? backupConnErr.message
            : String(backupConnErr),
        );
        return;
      }

      try {
        await backupClient.query('BEGIN');

        const formattedTableNames = tableNames.map((t) => `"${t}"`).join(', ');
        await backupClient.query(
          `TRUNCATE TABLE ${formattedTableNames} CASCADE`,
        );

        for (const table of tableNames) {
          const dataResult: QueryResult<Record<string, unknown>> =
            await mainClient.query<Record<string, unknown>>(
              `SELECT * FROM "${table}"`,
            );
          const tableData = dataResult.rows;

          if (tableData.length > 0) {
            const columns = Object.keys(tableData[0])
              .map((col) => `"${col}"`)
              .join(', ');

            for (const row of tableData) {
              const values = Object.values(row);
              const valuePlaceholders = values
                .map((_, index) => `$${index + 1}`)
                .join(', ');

              await backupClient.query(
                `INSERT INTO "${table}" (${columns}) VALUES (${valuePlaceholders})`,
                values,
              );
            }
          }
        }

        await backupClient.query('COMMIT');
        this.logger.log(
          `✅ [CRON] Backup DB successfully synchronized (${totalRowsInMain} total rows mirror-copied across ${tableNames.length} tables).`,
        );
      } catch (syncError) {
        await backupClient.query('ROLLBACK');
        this.logger.error(
          '❌ Error during backup database sync transaction:',
          syncError instanceof Error ? syncError.message : String(syncError),
        );
      } finally {
        if (backupClient) {
          await backupClient.end().catch(() => undefined);
        }
      }
    } catch (error) {
      this.logger.error(
        '❌ Failed to complete Main-to-Backup synchronization:',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      if (mainClient) {
        await mainClient.end().catch(() => undefined);
      }
    }
  }
}
