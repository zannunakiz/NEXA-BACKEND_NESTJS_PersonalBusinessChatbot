import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { DatabaseService } from '../database/database.service';
import { ClearDbResponse, TableDetail } from './dto/cleardb.dto';
import { GetAllUsersResponse, UserDto } from './dto/getallusers.dto';

@Injectable()
export class MasterService {
  private readonly logger = new Logger(MasterService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private validateMasterKey(masterKey: string): void {
    if (!masterKey || masterKey !== process.env.MASTER_KEY) {
      throw new UnauthorizedException('Invalid Master Key');
    }
  }

  private async cleanupCloudinaryAssets(mainUrl: string): Promise<void> {
    const client = await this.databaseService.getClient(mainUrl);
    try {
      const { rows: users } = await client.query<{ image_url: string | null }>(
        'SELECT image_url FROM users WHERE image_url IS NOT NULL',
      );
      const { rows: orgs } = await client.query<{ image_url: string | null }>(
        'SELECT image_url FROM organizations WHERE image_url IS NOT NULL',
      );
      const { rows: bots } = await client.query<{ image_url: string | null }>(
        'SELECT image_url FROM chatbots WHERE image_url IS NOT NULL',
      );

      const allUrls = [
        ...users.map((r) => r.image_url),
        ...orgs.map((r) => r.image_url),
        ...bots.map((r) => r.image_url),
      ].filter((url): url is string => Boolean(url));

      const publicIds = allUrls
        .map((url) => {
          try {
            return this.cloudinaryService.extractPublicIdFromUrl(url);
          } catch {
            return null;
          }
        })
        .filter((id): id is string => Boolean(id));

      if (publicIds.length > 0) {
        await Promise.allSettled(
          publicIds.map((id) => this.cloudinaryService.deleteImage(id)),
        );
      }
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async wipeDatabaseNode(connectionUrl?: string): Promise<TableDetail> {
    if (!connectionUrl) {
      return {
        chats: 0,
        sessions: 0,
        characteristics: 0,
        chatbots: 0,
        members: 0,
        organizations: 0,
        users: 0,
      };
    }

    const client = await this.databaseService.getClient(connectionUrl);

    try {
      await client.query('BEGIN');

      const delChats = await client.query('DELETE FROM chats');
      const delSessions = await client.query('DELETE FROM sessions');
      const delCharacteristics = await client.query(
        'DELETE FROM characteristics',
      );
      const delChatbots = await client.query('DELETE FROM chatbots');
      const delMembers = await client.query('DELETE FROM members');
      const delOrganizations = await client.query('DELETE FROM organizations');
      const delUsers = await client.query('DELETE FROM users');

      await client.query('COMMIT');

      return {
        chats: delChats.rowCount ?? 0,
        sessions: delSessions.rowCount ?? 0,
        characteristics: delCharacteristics.rowCount ?? 0,
        chatbots: delChatbots.rowCount ?? 0,
        members: delMembers.rowCount ?? 0,
        organizations: delOrganizations.rowCount ?? 0,
        users: delUsers.rowCount ?? 0,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  async cleardb(masterKey: string): Promise<ClearDbResponse> {
    this.validateMasterKey(masterKey);

    this.logger.warn(
      '⚠️ [DANGER] Initiating full NEXA database wipe across main, duplicate, and backup nodes...',
    );

    try {
      const mainUrl = process.env.NEONDB_MAIN_URL;
      const duplicateUrl = process.env.NEONDB_DUPLICATE_URL;
      const backupUrl = process.env.NEONDB_BACKUP_URL;

      if (mainUrl) {
        await this.cleanupCloudinaryAssets(mainUrl);
      }

      const mainDetail = await this.wipeDatabaseNode(mainUrl);
      const duplicateDetail = await this.wipeDatabaseNode(duplicateUrl);
      const backupDetail = await this.wipeDatabaseNode(backupUrl);

      const sumTableDetail = (detail: TableDetail): number =>
        detail.chats +
        detail.sessions +
        detail.characteristics +
        detail.chatbots +
        detail.members +
        detail.organizations +
        detail.users;

      const totalDeleted =
        sumTableDetail(mainDetail) +
        sumTableDetail(duplicateDetail) +
        sumTableDetail(backupDetail);

      this.logger.log(
        '✅ Main, Duplicate, and Backup databases successfully wiped for NEXA system.',
      );

      return {
        message:
          'All records across main, duplicate, and backup databases and Cloudinary media permanently cleared.',
        totalDeleted,
        primary: mainDetail,
        replica: duplicateDetail,
        backup: backupDetail,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        '❌ Failed to clear database nodes:',
        (error as Error).stack || (error as Error).message,
      );
      throw new InternalServerErrorException(
        'Failed to wipe database nodes and clean media storage',
      );
    }
  }

  async getAllUsers(masterKey: string): Promise<GetAllUsersResponse> {
    this.validateMasterKey(masterKey);

    try {
      const rows = await this.databaseService.executeRead<UserDto>(
        'SELECT id, email, username, image_url, created_at, updated_at FROM users ORDER BY created_at DESC',
      );

      return {
        message: 'All users fetched successfully.',
        totalUsers: rows.length,
        users: rows,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        '❌ Failed to fetch all users:',
        (error as Error).stack || (error as Error).message,
      );
      throw new InternalServerErrorException('Failed to fetch users list');
    }
  }
}
