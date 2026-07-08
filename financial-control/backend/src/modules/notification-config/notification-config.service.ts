import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertNotificationConfigDto } from './dto/upsert-notification-config.dto';
import { NotificationChannel } from '@prisma/client';

@Injectable()
export class NotificationConfigService {
  constructor(private prisma: PrismaService) {}

  async findAllForUser(userId: string) {
    return this.prisma.notificationConfig.findMany({
      where: { userId },
      orderBy: { channel: 'asc' },
    });
  }

  async upsert(
    userId: string,
    channel: NotificationChannel,
    dto: UpsertNotificationConfigDto,
  ) {
    return this.prisma.notificationConfig.upsert({
      where: { userId_channel: { userId, channel } },
      create: { userId, channel, ...dto },
      update: { ...dto },
    });
  }
}
