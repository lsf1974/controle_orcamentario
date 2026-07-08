import { Test, TestingModule } from '@nestjs/testing';
import { CreditCardsService } from '../credit-cards.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CardBrand } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  creditCard: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  bankAccount: { findFirst: jest.fn() },
  project: { findFirst: jest.fn() },
  projectCreditCard: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  transaction: { count: jest.fn() },
};

const baseDto = {
  name: 'Cartão Corporativo',
  brand: CardBrand.VISA,
  lastFourDigits: '1234',
  creditLimit: 10000,
  billingDay: 10,
  closingDay: 3,
};

describe('CreditCardsService', () => {
  let service: CreditCardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditCardsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CreditCardsService>(CreditCardsService);
    jest.clearAllMocks();
  });

  it('should create a credit card', async () => {
    mockPrisma.creditCard.create.mockResolvedValue({ id: 'cc1' });
    const result = await service.create(baseDto);
    expect(result.id).toBe('cc1');
  });

  it('should throw NotFoundException for unknown paymentAccountId', async () => {
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ ...baseDto, paymentAccountId: 'nope' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.creditCard.create).not.toHaveBeenCalled();
  });

  it('should block remove when card has transactions', async () => {
    mockPrisma.creditCard.findFirst.mockResolvedValue({ id: 'cc1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(1);
    await expect(service.remove('cc1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.creditCard.update).not.toHaveBeenCalled();
  });

  it('should block unassign when project has transactions for the card', async () => {
    mockPrisma.projectCreditCard.findUnique.mockResolvedValue({ id: 'pc1' });
    mockPrisma.transaction.count.mockResolvedValue(1);
    await expect(service.unassignFromProject('p1', 'cc1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw ConflictException when card already assigned', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
    mockPrisma.creditCard.findFirst.mockResolvedValue({ id: 'cc1', deletedAt: null });
    mockPrisma.projectCreditCard.findUnique.mockResolvedValue({ id: 'pc1' });
    await expect(service.assignToProject('p1', 'cc1')).rejects.toThrow(
      ConflictException,
    );
  });
});
