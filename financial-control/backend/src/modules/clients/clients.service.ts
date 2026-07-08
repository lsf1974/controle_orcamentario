import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { throwConflictIfUniqueViolation } from '../../common/utils/prisma-errors';
import { assertPersonNames } from '../../common/utils/person-names.util';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) throw new NotFoundException(`Cliente ${id} não encontrado`);
    return client;
  }

  async create(dto: CreateClientDto) {
    assertPersonNames(dto);
    const exists = await this.prisma.client.findFirst({
      where: { taxId: dto.taxId, deletedAt: null },
    });
    if (exists) throw new ConflictException('CPF/CNPJ já cadastrado');
    try {
      return await this.prisma.client.create({ data: dto });
    } catch (error) {
      throwConflictIfUniqueViolation(error, 'CPF/CNPJ já cadastrado');
    }
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    if (dto.taxId) {
      const exists = await this.prisma.client.findFirst({
        where: { taxId: dto.taxId, deletedAt: null, id: { not: id } },
      });
      if (exists) throw new ConflictException('CPF/CNPJ já cadastrado');
    }
    try {
      return await this.prisma.client.update({ where: { id }, data: dto });
    } catch (error) {
      throwConflictIfUniqueViolation(error, 'CPF/CNPJ já cadastrado');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const [txCount, blCount] = await Promise.all([
      this.prisma.transaction.count({ where: { clientId: id, deletedAt: null } }),
      this.prisma.budgetLine.count({ where: { clientId: id } }),
    ]);
    if (txCount + blCount > 0) {
      throw new ConflictException(
        'Cliente possui lançamentos ou linhas de orçamento vinculados — desative-o (isActive: false) em vez de excluir',
      );
    }
    await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findByProject(projectId: string) {
    const rows = await this.prisma.projectClient.findMany({
      where: { projectId, client: { deletedAt: null } },
      include: { client: true },
    });
    return rows.map((r) => r.client);
  }

  async assignToProject(projectId: string, clientId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Projeto ${projectId} não encontrado`);

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client)
      throw new NotFoundException(`Cliente ${clientId} não encontrado`);

    const existing = await this.prisma.projectClient.findUnique({
      where: { projectId_clientId: { projectId, clientId } },
    });
    if (existing)
      throw new ConflictException('Cliente já está associado ao projeto');

    return this.prisma.projectClient.create({ data: { projectId, clientId } });
  }

  async unassignFromProject(projectId: string, clientId: string) {
    const pc = await this.prisma.projectClient.findUnique({
      where: { projectId_clientId: { projectId, clientId } },
    });
    if (!pc)
      throw new NotFoundException('Cliente não está associado ao projeto');

    const [txCount, blCount] = await Promise.all([
      this.prisma.transaction.count({
        where: { projectId, clientId, deletedAt: null },
      }),
      this.prisma.budgetLine.count({
        where: { clientId, budget: { projectId } },
      }),
    ]);
    if (txCount + blCount > 0) {
      throw new ConflictException(
        'Cliente possui lançamentos ou linhas de orçamento neste projeto — não é possível desassociar',
      );
    }

    await this.prisma.projectClient.delete({
      where: { projectId_clientId: { projectId, clientId } },
    });
  }
}
