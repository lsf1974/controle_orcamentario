import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemRole, ProjectRole } from '@prisma/client';
import { PROJECT_ROLES_KEY } from '../decorators/requires-project-role.decorator';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;
    if (user.systemRole === SystemRole.ADMIN) return true;

    const projectId = request.params?.projectId ?? request.body?.projectId;

    if (!projectId) return false;

    const projectUser = await this.prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });

    if (!projectUser) return false;

    // Verificar que o projeto não foi soft-deletado
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) return false;

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const roleHierarchy: Record<ProjectRole, number> = {
      [ProjectRole.GESTOR]: 2,
      [ProjectRole.ANALISTA]: 1,
    };

    const userLevel = roleHierarchy[projectUser.role] ?? 0;
    const minRequired = Math.min(
      ...requiredRoles.map((r) => roleHierarchy[r] ?? 99),
    );

    if (minRequired === 99) {
      throw new InternalServerErrorException('Perfil de projeto requerido inválido — configuração interna incorreta');
    }

    if (userLevel < minRequired) {
      throw new ForbiddenException(
        `Acesso negado: requer perfil ${requiredRoles.join(' ou ')} no projeto`,
      );
    }

    return true;
  }
}
