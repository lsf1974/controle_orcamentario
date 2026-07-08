import { Test, TestingModule } from '@nestjs/testing';
import { AccountCategoriesService } from '../account-categories.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CategoryLevel, CategoryType } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  project: { findFirst: jest.fn() },
  accountCategory: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  transaction: { count: jest.fn() },
  budgetLine: { count: jest.fn() },
};

describe('AccountCategoriesService', () => {
  let service: AccountCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountCategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AccountCategoriesService>(AccountCategoriesService);
    jest.clearAllMocks();
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
  });

  it('should create a PACKAGE without parent', async () => {
    mockPrisma.accountCategory.create.mockResolvedValue({ id: 'c1' });
    const result = await service.create('p1', {
      code: '1',
      name: 'Receitas',
      type: CategoryType.REVENUE,
      level: CategoryLevel.PACKAGE,
    });
    expect(result.id).toBe('c1');
  });

  it('should reject PACKAGE with a parentId', async () => {
    await expect(
      service.create('p1', {
        code: '1',
        name: 'X',
        type: CategoryType.REVENUE,
        level: CategoryLevel.PACKAGE,
        parentId: 'somebody',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject CATEGORY without a parentId', async () => {
    await expect(
      service.create('p1', {
        code: '1.1',
        name: 'X',
        type: CategoryType.REVENUE,
        level: CategoryLevel.CATEGORY,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject CATEGORY whose parent is not a PACKAGE', async () => {
    // parent existe mas é do nível errado (CATEGORY, não PACKAGE)
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'parent',
      projectId: 'p1',
      level: CategoryLevel.CATEGORY,
    });
    await expect(
      service.create('p1', {
        code: '1.1',
        name: 'X',
        type: CategoryType.REVENUE,
        level: CategoryLevel.CATEGORY,
        parentId: 'parent',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject when parent belongs to another project', async () => {
    mockPrisma.accountCategory.findFirst.mockResolvedValue(null); // não achou no projeto p1
    await expect(
      service.create('p1', {
        code: '1.1',
        name: 'X',
        type: CategoryType.REVENUE,
        level: CategoryLevel.CATEGORY,
        parentId: 'parent-de-outro-projeto',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create a CATEGORY with a valid PACKAGE parent', async () => {
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'parent',
      projectId: 'p1',
      level: CategoryLevel.PACKAGE,
    });
    mockPrisma.accountCategory.create.mockResolvedValue({ id: 'c2' });
    const result = await service.create('p1', {
      code: '1.1',
      name: 'Vendas',
      type: CategoryType.REVENUE,
      level: CategoryLevel.CATEGORY,
      parentId: 'parent',
    });
    expect(result.id).toBe('c2');
  });

  it('should block moving a node that has active children', async () => {
    // current é um PACKAGE com filhos ativos; tenta virar CATEGORY
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'c1',
      projectId: 'p1',
      level: CategoryLevel.PACKAGE,
      parentId: null,
      deletedAt: null,
    });
    mockPrisma.accountCategory.count.mockResolvedValue(2); // filhos ativos
    await expect(
      service.update('p1', 'c1', {
        level: CategoryLevel.CATEGORY,
        parentId: 'outro-pacote',
      }),
    ).rejects.toThrow(ConflictException);
    expect(mockPrisma.accountCategory.update).not.toHaveBeenCalled();
  });

  it('should block remove when category has active children', async () => {
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'c1',
      projectId: 'p1',
      deletedAt: null,
    });
    mockPrisma.accountCategory.count.mockResolvedValue(2); // filhos
    await expect(service.remove('p1', 'c1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.accountCategory.update).not.toHaveBeenCalled();
  });

  it('should block remove when category is used in transactions', async () => {
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'c1',
      projectId: 'p1',
      deletedAt: null,
    });
    mockPrisma.accountCategory.count.mockResolvedValue(0);
    mockPrisma.transaction.count.mockResolvedValue(1);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    await expect(service.remove('p1', 'c1')).rejects.toThrow(ConflictException);
  });

  it('should soft-delete a leaf category with no usage', async () => {
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'c1',
      projectId: 'p1',
      deletedAt: null,
    });
    mockPrisma.accountCategory.count.mockResolvedValue(0);
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    mockPrisma.accountCategory.update.mockResolvedValue({});

    await service.remove('p1', 'c1');

    expect(mockPrisma.accountCategory.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });
});
