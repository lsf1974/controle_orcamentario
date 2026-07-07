import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { ProjectStatus, SystemRole } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, userRole: SystemRole) {
    if (userRole === SystemRole.ADMIN) {
      return this.prisma.project.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
    }
    return this.prisma.project.findMany({
      where: {
        deletedAt: null,
        projectUsers: { some: { userId } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(
    id: string,
    requestingUser?: { id: string; systemRole: SystemRole },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id, deletedAt: null },
      include: {
        projectUsers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!project) throw new NotFoundException(`Projeto ${id} não encontrado`);

    if (
      requestingUser &&
      requestingUser.systemRole !== SystemRole.ADMIN
    ) {
      const isMember = project.projectUsers.some(
        (pu) => pu.userId === requestingUser.id,
      );
      if (!isMember) {
        throw new ForbiddenException('Acesso negado ao projeto');
      }
    }

    return project;
  }

  async create(dto: CreateProjectDto) {
    return this.prisma.project.create({ data: dto });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProjectStatus.CLOSED },
    });
  }

  async assignUser(projectId: string, dto: AssignUserDto) {
    await this.findOne(projectId);

    const userExists = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!userExists)
      throw new NotFoundException(`Usuário ${dto.userId} não encontrado`);

    const existing = await this.prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
    if (existing) throw new ConflictException('Usuário já está no projeto');

    return this.prisma.projectUser.create({
      data: { projectId, userId: dto.userId, role: dto.role },
    });
  }

  async removeUser(projectId: string, userId: string) {
    const pu = await this.prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!pu) throw new NotFoundException('Usuário não encontrado no projeto');
    await this.prisma.projectUser.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
