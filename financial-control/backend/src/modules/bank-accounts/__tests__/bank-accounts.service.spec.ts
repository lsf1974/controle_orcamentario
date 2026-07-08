import { Test, TestingModule } from '@nestjs/testing';
import { BankAccountsService } from '../bank-accounts.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BankAccountType } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  bankAccount: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  project: { findFirst: jest.fn() },
  projectBankAccount: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  transaction: { count: jest.fn() },
  bankStatement: { count: jest.fn() },
  creditCard: { count: jest.fn() },
};

describe('BankAccountsService', () => {
  let service: BankAccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankAccountsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<BankAccountsService>(BankAccountsService);
    jest.clearAllMocks();
  });

  it('should create a bank account converting initialDate to Date', async () => {
    mockPrisma.bankAccount.create.mockResolvedValue({ id: 'b1' });

    await service.create({
      name: 'Conta Principal',
      bankName: 'Banco X',
      accountType: BankAccountType.CHECKING,
      initialDate: '2026-01-01',
    });

    expect(mockPrisma.bankAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ initialDate: expect.any(Date) }),
    });
  });

  it('should block remove when account has statements', async () => {
    mockPrisma.bankAccount.findFirst.mockResolvedValue({ id: 'b1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.bankStatement.count.mockResolvedValue(1);
    mockPrisma.creditCard.count.mockResolvedValue(0);

    await expect(service.remove('b1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.bankAccount.update).not.toHaveBeenCalled();
  });

  it('should block remove when account is payment account of a card', async () => {
    mockPrisma.bankAccount.findFirst.mockResolvedValue({ id: 'b1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.bankStatement.count.mockResolvedValue(0);
    mockPrisma.creditCard.count.mockResolvedValue(1);

    await expect(service.remove('b1')).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when assigning unknown account', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);
    await expect(service.assignToProject('p1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should block unassign when project has transactions for the account', async () => {
    mockPrisma.projectBankAccount.findUnique.mockResolvedValue({ id: 'pb1' });
    mockPrisma.transaction.count.mockResolvedValue(2);
    await expect(service.unassignFromProject('p1', 'b1')).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.projectBankAccount.delete).not.toHaveBeenCalled();
  });
});
