import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { throwConflictIfUniqueViolation } from '../../common/utils/prisma-errors';

@Injectable()
export class CostCentersService {
  constructor(private prisma: PrismaService) {}

  private async assertProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Projeto ${projectId} não encontrado`);
  }

  async findByProject(projectId: string) {
    await this.assertProject(projectId);
    return this.prisma.costCenter.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  async findOneInProject(projectId: string, id: string) {
    const cc = await this.prisma.costCenter.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!cc)
      throw new NotFoundException(
        `Centro de custo ${id} não encontrado neste projeto`,
      );
    return cc;
  }

  async create(projectId: string, dto: CreateCostCenterDto) {
    await this.assertProject(projectId);
    try {
      return await this.prisma.costCenter.create({
        data: { ...dto, projectId },
      });
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        `Código '${dto.code}' já existe neste projeto`,
      );
    }
  }

  async update(projectId: string, id: string, dto: UpdateCostCenterDto) {
    await this.findOneInProject(projectId, id);
    try {
      return await this.prisma.costCenter.update({ where: { id }, data: dto });
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        `Código '${dto.code}' já existe neste projeto`,
      );
    }
  }

  async remove(projectId: string, id: string) {
    await this.findOneInProject(projectId, id);
    const [txCount, blCount] = await Promise.all([
      this.prisma.transaction.count({ where: { costCenterId: id, deletedAt: null } }),
      this.prisma.budgetLine.count({ where: { costCenterId: id } }),
    ]);
    if (txCount + blCount > 0) {
      throw new ConflictException(
        'Centro de custo é usado em lançamentos ou orçamento — desative-o (isActive: false) em vez de excluir',
      );
    }
    await this.prisma.costCenter.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
