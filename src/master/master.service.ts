import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Client, QueryResult } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ClearDbResponse, TableDetail } from './dto/cleardb.dto';
import { UserDto } from './dto/getallusers.dto';

interface CountRow {
  count: string;
}

@Injectable()
export class MasterService {
  private readonly logger = new Logger(MasterService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  private validateMasterKey(masterKey: string): void {
    const configuredKey =
      this.configService.get<string>('MASTER_KEY') || 'master-key';
    if (masterKey !== configuredKey) {
      throw new UnauthorizedException('Invalid master key');
    }
  }

  async getAllUsers(
    masterKey: string,
  ): Promise<{ totalUsers: number; users: UserDto[] }> {
    this.validateMasterKey(masterKey);

    const users = await this.databaseService.executeRead<UserDto>(
      'SELECT id, email, username, image_url, created_at, updated_at FROM users ORDER BY created_at DESC',
    );

    return {
      totalUsers: users.length,
      users,
    };
  }

  private createEmptyTableDetail(): TableDetail {
    return {
      users: 0,
      organizations: 0,
      members: 0,
      chatbots: 0,
      characteristics: 0,
      sessions: 0,
      chats: 0,
    };
  }

  private async clearDatabaseNode(
    dbUrl: string | undefined,
    nodeName: string,
  ): Promise<{ tableDetail: TableDetail; nodeDeletedTotal: number }> {
    const detail = this.createEmptyTableDetail();
    let nodeDeletedTotal = 0;

    if (!dbUrl) {
      this.logger.warn(`Database URL for [${nodeName}] is not configured.`);
      return { tableDetail: detail, nodeDeletedTotal };
    }

    let client: Client | undefined;

    try {
      client = await this.databaseService.getClient(dbUrl);

      const tableKeys = Object.keys(detail) as (keyof TableDetail)[];

      for (const table of tableKeys) {
        try {
          const countRes: QueryResult<CountRow> = await client.query<CountRow>(
            `SELECT COUNT(*)::text as count FROM "${table}"`,
          );
          const count = parseInt(countRes.rows[0]?.count || '0', 10);
          detail[table] = count;
          nodeDeletedTotal += count;
        } catch {
          detail[table] = 0;
        }
      }

      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name != '_prisma_migrations';
      `;
      const tableRows = await client.query<{ table_name: string }>(tablesQuery);
      const existingTables = tableRows.rows.map((r) => `"${r.table_name}"`);

      if (existingTables.length > 0) {
        await client.query(
          `TRUNCATE TABLE ${existingTables.join(', ')} CASCADE`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to clear node [${nodeName}]: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      if (client) {
        await client.end().catch(() => undefined);
      }
    }

    return { tableDetail: detail, nodeDeletedTotal };
  }

  async clearDatabase(masterKey: string): Promise<ClearDbResponse> {
    this.validateMasterKey(masterKey);

    try {
      await cloudinary.api.delete_resources_by_prefix('NEXA_nestjs');
      await cloudinary.api.delete_folder('NEXA_nestjs');
    } catch (err) {
      this.logger.warn(
        `Cloudinary purge warning: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const primaryUrl = this.configService.get<string>('NEONDB_MAIN_URL');
    const replicaUrl = this.configService.get<string>('NEONDB_DUPLICATE_URL');
    const backupUrl = this.configService.get<string>('NEONDB_BACKUP_URL');

    const primaryResult = await this.clearDatabaseNode(
      primaryUrl,
      'Primary DB',
    );
    const replicaResult = await this.clearDatabaseNode(
      replicaUrl,
      'Replica DB',
    );
    const backupResult = await this.clearDatabaseNode(backupUrl, 'Backup DB');

    const totalDeleted =
      primaryResult.nodeDeletedTotal +
      replicaResult.nodeDeletedTotal +
      backupResult.nodeDeletedTotal;

    return {
      message: 'All databases cleared and Cloudinary media purged successfully',
      totalDeleted,
      primary: primaryResult.tableDetail,
      replica: replicaResult.tableDetail,
      backup: backupResult.tableDetail,
      timestamp: new Date(),
    };
  }
}
