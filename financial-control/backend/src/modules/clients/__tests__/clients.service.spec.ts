import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from '../clients.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PersonType } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  client: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  project: { findFirst: jest.fn() },
  projectClient: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  transaction: { count: jest.fn() },
  budgetLine: { count: jest.fn() },
};

describe('ClientsService', () => {
  let service: ClientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ClientsService>(ClientsService);
    jest.clearAllMocks();
  });

  it('should throw ConflictException for duplicate taxId on create', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'c1' });
    await expect(
      service.create({
        personType: PersonType.COMPANY,
        companyName: 'X',
        taxId: '12345678000190',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should block remove when client has budget lines', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'c1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(3);

    await expect(service.remove('c1')).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when assigning unknown client', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
    mockPrisma.client.findFirst.mockResolvedValue(null);
    await expect(service.assignToProject('p1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw ConflictException when client already assigned', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'c1', deletedAt: null });
    mockPrisma.projectClient.findUnique.mockResolvedValue({ id: 'pc1' });
    await expect(service.assignToProject('p1', 'c1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should block unassign when project has transactions for the client', async () => {
    mockPrisma.projectClient.findUnique.mockResolvedValue({ id: 'pc1' });
    mockPrisma.transaction.count.mockResolvedValue(1);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    await expect(service.unassignFromProject('p1', 'c1')).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.projectClient.delete).not.toHaveBeenCalled();
  });

  it('should unassign client without dependents', async () => {
    mockPrisma.projectClient.findUnique.mockResolvedValue({ id: 'pc1' });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    mockPrisma.projectClient.delete.mockResolvedValue({});

    await service.unassignFromProject('p1', 'c1');

    expect(mockPrisma.projectClient.delete).toHaveBeenCalledWith({
      where: { projectId_clientId: { projectId: 'p1', clientId: 'c1' } },
    });
  });
});
