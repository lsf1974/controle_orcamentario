import { Test, TestingModule } from '@nestjs/testing';
import { NotificationConfigService } from '../notification-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationChannel } from '@prisma/client';

const mockPrisma = {
  notificationConfig: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('NotificationConfigService', () => {
  let service: NotificationConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationConfigService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<NotificationConfigService>(NotificationConfigService);
    jest.clearAllMocks();
  });

  it('should list configs for a user', async () => {
    mockPrisma.notificationConfig.findMany.mockResolvedValue([{ id: 'n1' }]);
    const result = await service.findAllForUser('u1');
    expect(result).toHaveLength(1);
    expect(mockPrisma.notificationConfig.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { channel: 'asc' },
    });
  });

  it('should upsert a config scoped to userId + channel', async () => {
    mockPrisma.notificationConfig.upsert.mockResolvedValue({ id: 'n1' });

    await service.upsert('u1', NotificationChannel.EMAIL, {
      alertDueToday: false,
    });

    expect(mockPrisma.notificationConfig.upsert).toHaveBeenCalledWith({
      where: {
        userId_channel: { userId: 'u1', channel: NotificationChannel.EMAIL },
      },
      create: {
        userId: 'u1',
        channel: NotificationChannel.EMAIL,
        alertDueToday: false,
      },
      update: { alertDueToday: false },
    });
  });
});
