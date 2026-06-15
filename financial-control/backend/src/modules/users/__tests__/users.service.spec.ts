import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SystemRole } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  $transaction: jest.fn((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma)),
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
    // restore $transaction after clearAllMocks
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );
  });

  it('should list all users (admin)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: '1', name: 'A', email: 'a@a.com', systemRole: SystemRole.USER },
    ]);

    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
  });

  it('should throw NotFoundException for unknown user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
  });

  it('should soft-delete non-admin user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      deletedAt: null,
      systemRole: SystemRole.USER,
    });
    mockPrisma.user.update.mockResolvedValue({ id: '1', deletedAt: new Date() });

    await service.remove('1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });

  it('should throw BadRequestException when removing last admin', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      deletedAt: null,
      systemRole: SystemRole.ADMIN,
    });
    mockPrisma.user.count.mockResolvedValue(0);

    await expect(service.remove('1')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when non-admin updates another user', async () => {
    await expect(
      service.update(
        'other-user-id',
        { name: 'Hacked' },
        { id: 'my-id', systemRole: SystemRole.USER },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should allow deleting an admin when another admin exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      deletedAt: null,
      systemRole: SystemRole.ADMIN,
    });
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.user.update.mockResolvedValue({ id: '1', deletedAt: new Date() });

    await service.remove('1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });
});
