import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super();
    // Middleware deve ser registrado ANTES de $connect para interceptar queries do startup
    this.applySoftDeleteMiddleware();
  }

  async onModuleInit() {
    await this.$connect();
  }

  private applySoftDeleteMiddleware() {
    const SOFT_DELETE_MODELS = new Set([
      'User', 'Project', 'Client', 'Supplier', 'AccountCategory',
      'BankAccount', 'CreditCard', 'CostCenter', 'Transaction',
    ]);

    this.$use(async (params, next) => {
      if (!SOFT_DELETE_MODELS.has(params.model ?? '')) return next(params);

      const action = params.action;

      const isFilteredRead = action === 'findUnique'
        || action === 'findFirst'
        || action === 'findUniqueOrThrow'
        || action === 'findFirstOrThrow'
        || action === 'findMany'
        || action === 'count'
        || action === 'aggregate'
        || action === 'groupBy';

      if (isFilteredRead) {
        params.args = params.args ?? {};
        params.args.where = params.args.where ?? {};
        if (!('deletedAt' in params.args.where)) {
          params.args.where.deletedAt = null;
        }
        if (action === 'findUnique') params.action = 'findFirst';
        if (action === 'findUniqueOrThrow') params.action = 'findFirstOrThrow';
      }

      if (action === 'delete') {
        params.action = 'update';
        params.args.data = { ...params.args.data, deletedAt: new Date() };
      }

      if (action === 'deleteMany') {
        const where = params.args?.where;
        const isEmpty = !where || Object.keys(where).length === 0;
        const hasEmptyLogical =
          (where?.OR !== undefined && (!Array.isArray(where.OR) || where.OR.length === 0)) ||
          (where?.AND !== undefined && (!Array.isArray(where.AND) || where.AND.length === 0)) ||
          (where?.NOT !== undefined && typeof where.NOT === 'object' &&
            !Array.isArray(where.NOT) && Object.keys(where.NOT as object).length === 0);
        if (isEmpty || hasEmptyLogical) {
          throw new Error(
            `deleteMany sem filtro efetivo em '${params.model}' é proibido — use where explícito ou hardDelete()`,
          );
        }
        params.action = 'updateMany';
        params.args.data = { deletedAt: new Date() };
      }

      return next(params);
    });
  }
}
