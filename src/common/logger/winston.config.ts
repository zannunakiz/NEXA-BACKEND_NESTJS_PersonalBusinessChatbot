import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import { ClsServiceManager } from 'nestjs-cls';
import * as path from 'path';
import * as winston from 'winston';

const injectRequestId = winston.format((info) => {
  const cls = ClsServiceManager.getClsService();
  const requestId = cls?.get<string>('requestId');
  if (requestId) {
    info.requestId = requestId;
  }
  return info;
});

export const winstonConfig = {
  transports: [
    // 1. Tampilkan Log di Terminal (Console)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        injectRequestId(),
        nestWinstonModuleUtilities.format.nestLike('NestApp', {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),

    // 2. Simpan KHUSUS Log Error ke folder logs/error.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs/error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        injectRequestId(),
        winston.format.json(),
      ),
    }),

    // 3. Simpan SEMUA Log ke folder logs/combined.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs/combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        injectRequestId(),
        winston.format.json(),
      ),
    }),
  ],
};
