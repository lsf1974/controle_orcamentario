import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from '../suppliers.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PersonType } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

const mockPrisma = {
  supplier: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  transaction: { count: jest.fn() },
  budgetLine: { count: jest.fn() },
};

describe('SuppliersService', () => {
  let service: SuppliersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
    jest.clearAllMocks();
  });

  it('should create a supplier', async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue(null);
    mockPrisma.supplier.create.mockResolvedValue({ id: 's1', taxId: '123' });

    const result = await service.create({
      personType: PersonType.COMPANY,
      companyName: 'Fornecedor X',
      taxId: '12345678000190',
    });
    expect(result.id).toBe('s1');
  });

  it('should throw ConflictException for duplicate taxId', async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 's1' });
    await expect(
      service.create({
        personType: PersonType.COMPANY,
        companyName: 'Y',
        taxId: '12345678000190',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject COMPANY without companyName on create', async () => {
    await expect(
      service.create({
        personType: PersonType.COMPANY,
        taxId: '12345678000190',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.supplier.create).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException for unknown supplier', async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
  });

  it('should block remove when supplier has transactions', async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 's1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(2);
    mockPrisma.budgetLine.count.mockResolvedValue(0);

    await expect(service.remove('s1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.supplier.update).not.toHaveBeenCalled();
  });

  it('should soft-delete supplier without dependents', async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 's1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    mockPrisma.supplier.update.mockResolvedValue({});

    await service.remove('s1');

    expect(mockPrisma.supplier.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });
});
