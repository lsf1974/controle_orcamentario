import { Module } from '@nestjs/common';
import { NotificationConfigController } from './notification-config.controller';
import { NotificationConfigService } from './notification-config.service';

@Module({
  controllers: [NotificationConfigController],
  providers: [NotificationConfigService],
  exports: [NotificationConfigService],
})
export class NotificationConfigModule {}
