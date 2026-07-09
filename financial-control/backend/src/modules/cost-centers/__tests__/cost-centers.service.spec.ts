import { Test, TestingModule } from '@nestjs/testing';
import { CostCentersService } from '../cost-centers.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  project: { findFirst: jest.fn() },
  costCenter: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  transaction: { count: jest.fn() },
  budgetLine: { count: jest.fn() },
};

describe('CostCentersService', () => {
  let service: CostCentersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostCentersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CostCentersService>(CostCentersService);
    jest.clearAllMocks();
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
  });

  it('should create a cost center', async () => {
    mockPrisma.costCenter.create.mockResolvedValue({ id: 'cc1' });
    const result = await service.create('p1', { code: 'ADM', name: 'Administrativo' });
    expect(result.id).toBe('cc1');
    expect(mockPrisma.costCenter.create).toHaveBeenCalledWith({
      data: { code: 'ADM', name: 'Administrativo', projectId: 'p1' },
    });
  });

  it('should throw NotFoundException for unknown project', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    await expect(
      service.create('nope', { code: 'X', name: 'Y' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should block remove when used in budget lines', async () => {
    mockPrisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1', projectId: 'p1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(2);
    await expect(service.remove('p1', 'cc1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.costCenter.update).not.toHaveBeenCalled();
  });

  it('should soft-delete a cost center with no usage', async () => {
    mockPrisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1', projectId: 'p1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    mockPrisma.costCenter.update.mockResolvedValue({});

    await service.remove('p1', 'cc1');

    expect(mockPrisma.costCenter.update).toHaveBeenCalledWith({
      where: { id: 'cc1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });
});
