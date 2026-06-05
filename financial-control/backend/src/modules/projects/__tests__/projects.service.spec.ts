import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from '../projects.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';

const mockPrisma = {
  project: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  projectUser: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    jest.clearAllMocks();
  });

  it('should create project', async () => {
    mockPrisma.project.create.mockResolvedValue({
      id: 'proj-1',
      name: 'Projeto Alpha',
      status: 'ACTIVE',
    });

    const result = await service.create({
      name: 'Projeto Alpha',
      startDate: new Date('2026-01-01'),
    });

    expect(result).toHaveProperty('id');
    expect(mockPrisma.project.create).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException for unknown project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('should assign user to project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
    mockPrisma.projectUser.findUnique.mockResolvedValue(null);
    mockPrisma.projectUser.create.mockResolvedValue({
      projectId: 'proj-1',
      userId: 'user-1',
      role: ProjectRole.ANALISTA,
    });

    const result = await service.assignUser('proj-1', {
      userId: 'user-1',
      role: ProjectRole.ANALISTA,
    });

    expect(result.role).toBe(ProjectRole.ANALISTA);
  });

  it('should throw ConflictException if user already in project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
    mockPrisma.projectUser.findUnique.mockResolvedValue({
      projectId: 'proj-1',
      userId: 'user-1',
    });

    await expect(
      service.assignUser('proj-1', { userId: 'user-1', role: ProjectRole.GESTOR }),
    ).rejects.toThrow(ConflictException);
  });
});
