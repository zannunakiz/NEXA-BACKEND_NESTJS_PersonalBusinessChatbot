import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as path from 'path';
import * as winston from 'winston';

export const winstonConfig = {
  transports: [
    // 1. Tampilkan Log di Terminal (Console)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('NestApp', {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),

    // 2. Simpan KHUSUS Log Error ke folder logs/error.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs/error.log'),
      level: 'error', // Hanya menangkap log dengan level error ke atas
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),

    // 3. Simpan SEMUA Log (Info, Warn, Error) ke folder logs/combined.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs/combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
};
