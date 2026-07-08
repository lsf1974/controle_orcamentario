import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountCategoryDto } from './dto/create-account-category.dto';
import { UpdateAccountCategoryDto } from './dto/update-account-category.dto';
import { throwConflictIfUniqueViolation } from '../../common/utils/prisma-errors';
import { CategoryLevel } from '@prisma/client';

const LEVEL_RANK: Record<CategoryLevel, number> = {
  [CategoryLevel.PACKAGE]: 1,
  [CategoryLevel.CATEGORY]: 2,
  [CategoryLevel.SUBCATEGORY]: 3,
};

@Injectable()
export class AccountCategoriesService {
  constructor(private prisma: PrismaService) {}

  private async assertProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Projeto ${projectId} não encontrado`);
  }

  /**
   * Valida a coerência entre level e parentId e retorna nada.
   * PACKAGE não pode ter pai; CATEGORY/SUBCATEGORY exigem pai do nível
   * imediatamente acima, no mesmo projeto.
   */
  private async assertHierarchy(
    projectId: string,
    level: CategoryLevel,
    parentId?: string,
  ) {
    if (level === CategoryLevel.PACKAGE) {
      if (parentId) {
        throw new BadRequestException(
          'Um pacote (PACKAGE) não pode ter categoria pai',
        );
      }
      return;
    }

    if (!parentId) {
      throw new BadRequestException(
        `Nível ${level} exige uma categoria pai (parentId)`,
      );
    }

    const parent = await this.prisma.accountCategory.findFirst({
      where: { id: parentId, projectId, deletedAt: null },
      select: { id: true, level: true },
    });
    if (!parent) {
      throw new NotFoundException(
        `Categoria pai ${parentId} não encontrada neste projeto`,
      );
    }
    if (LEVEL_RANK[parent.level] !== LEVEL_RANK[level] - 1) {
      throw new BadRequestException(
        `Categoria pai deve ser do nível imediatamente acima de ${level}`,
      );
    }
  }

  async findByProject(projectId: string) {
    await this.assertProject(projectId);
    return this.prisma.accountCategory.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  async findOneInProject(projectId: string, id: string) {
    const category = await this.prisma.accountCategory.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!category)
      throw new NotFoundException(`Categoria ${id} não encontrada neste projeto`);
    return category;
  }

  async create(projectId: string, dto: CreateAccountCategoryDto) {
    await this.assertProject(projectId);
    await this.assertHierarchy(projectId, dto.level, dto.parentId);
    try {
      return await this.prisma.accountCategory.create({
        data: { ...dto, projectId },
      });
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        `Código '${dto.code}' já existe neste projeto`,
      );
    }
  }

  async update(projectId: string, id: string, dto: UpdateAccountCategoryDto) {
    const current = await this.findOneInProject(projectId, id);
    const nextLevel = dto.level ?? current.level;
    const levelChanged = dto.level !== undefined && dto.level !== current.level;
    const parentChanged =
      dto.parentId !== undefined && dto.parentId !== current.parentId;

    // Só revalida hierarquia se level ou parentId mudaram
    if (levelChanged || parentChanged) {
      // Reposicionar um nó que tem filhos ativos quebraria a coerência de
      // níveis da subárvore — bloqueia até que os filhos sejam movidos/removidos.
      const childCount = await this.prisma.accountCategory.count({
        where: { parentId: id, deletedAt: null },
      });
      if (childCount > 0) {
        throw new ConflictException(
          'Não é possível mudar o nível ou o pai de uma categoria que possui subcategorias ativas',
        );
      }
      const nextParent =
        dto.parentId !== undefined ? dto.parentId : current.parentId ?? undefined;
      await this.assertHierarchy(projectId, nextLevel, nextParent);
    }
    try {
      return await this.prisma.accountCategory.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        `Código '${dto.code}' já existe neste projeto`,
      );
    }
  }

  async remove(projectId: string, id: string) {
    await this.findOneInProject(projectId, id);

    const childCount = await this.prisma.accountCategory.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new ConflictException(
        'Categoria possui subcategorias ativas — exclua ou mova os filhos antes',
      );
    }

    const [txCount, blCount] = await Promise.all([
      this.prisma.transaction.count({ where: { categoryId: id, deletedAt: null } }),
      this.prisma.budgetLine.count({ where: { categoryId: id } }),
    ]);
    if (txCount + blCount > 0) {
      throw new ConflictException(
        'Categoria é usada em lançamentos ou orçamento — desative-a (isActive: false) em vez de excluir',
      );
    }

    await this.prisma.accountCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
