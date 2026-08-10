import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArcjetGuard } from './arcjet.guard';
import { ArcjetService } from './arcjet.service';

@Module({
  imports: [ConfigModule],
  providers: [ArcjetService, ArcjetGuard],
  exports: [ArcjetService, ArcjetGuard],
})
export class CustomArcjetModule {}
