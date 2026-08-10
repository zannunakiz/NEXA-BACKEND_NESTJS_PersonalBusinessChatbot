import { Module } from '@nestjs/common';
import { BackupSyncCron } from './backup-sync.cron';
import { DatabaseService } from './database.service';

@Module({
  providers: [DatabaseService, BackupSyncCron],
  exports: [DatabaseService],
})
export class DatabaseModule {}
