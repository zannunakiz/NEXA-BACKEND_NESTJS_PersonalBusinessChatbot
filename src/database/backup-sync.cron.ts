import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import cluster from 'node:cluster';
import { DatabaseService } from './database.service';

@Injectable()
export class BackupSyncCron {
  private readonly logger = new Logger(BackupSyncCron.name);

  constructor(private readonly databaseService: DatabaseService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleBackupSync(): Promise<void> {
    if (cluster.isWorker && cluster.worker?.id !== 1) {
      return;
    }

    const mainUrl = process.env.NEONDB_MAIN_URL;
    const backupUrl = process.env.NEONDB_BACKUP_URL;

    if (!mainUrl || !backupUrl) {
      this.logger.warn('Main DB or Backup DB URL missing. Skipping sync.');
      return;
    }

    this.logger.log('🔄 [CRON] Starting Backup Synchronization process...');

    const mainClient = await this.databaseService.getClient(mainUrl);

    try {
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name != '_prisma_migrations';
      `;

      const { rows: tableRows } = await mainClient.query<{
        table_name: string;
      }>(tablesQuery);
      const tableNames = tableRows.map((r) => r.table_name);

      if (tableNames.length === 0) {
        this.logger.warn(
          '⚠️ No tables found in Main DB. Skipping backup sync.',
        );
        return;
      }

      let totalRowsInMain = 0;
      for (const table of tableNames) {
        const { rows } = await mainClient.query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM "${table}"`,
        );
        totalRowsInMain += parseInt(rows[0]?.count || '0', 10);
      }

      if (totalRowsInMain === 0) {
        this.logger.error(
          '🚨 [CRITICAL ALERT] Main DB total rows is 0! Potential wipe or fatal error detected. SKIP SYNC to protect Backup DB.',
        );
        return;
      }

      const backupClient = await this.databaseService.getClient(backupUrl);

      try {
        await backupClient.query('BEGIN');

        for (const table of tableNames) {
          await backupClient.query(`TRUNCATE TABLE "${table}" CASCADE`);

          const { rows: tableData } = await mainClient.query<
            Record<string, unknown>
          >(`SELECT * FROM "${table}"`);

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
          `✅ [CRON] Backup DB successfully synchronized (${totalRowsInMain} total rows mirror-copied).`,
        );
      } catch (syncError) {
        await backupClient.query('ROLLBACK');
        this.logger.error(
          '❌ Error during backup database sync transaction:',
          (syncError as Error).message,
        );
      } finally {
        await backupClient.end().catch(() => undefined);
      }
    } catch (error) {
      this.logger.error(
        '❌ Failed to complete Main-to-Backup synchronization:',
        (error as Error).message,
      );
    } finally {
      await mainClient.end().catch(() => undefined);
    }
  }
}
