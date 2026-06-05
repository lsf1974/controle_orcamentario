import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SystemRole } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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

  it('should soft-delete user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: '1', deletedAt: null });
    mockPrisma.user.update.mockResolvedValue({ id: '1', deletedAt: new Date() });

    await service.remove('1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });
});
