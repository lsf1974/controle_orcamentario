import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const SOFT_DELETE_MODELS = new Set([
  'User', 'Project', 'Client', 'Supplier', 'AccountCategory',
  'BankAccount', 'CreditCard', 'CostCenter', 'Transaction',
]);

// findUnique/findUniqueOrThrow ficam de fora: seu where só aceita campos @unique,
// então não dá para injetar deletedAt ali — são redirecionados para findFirst
// (ver softDeleteModelMethods), que aceita where arbitrário.
const FILTERED_READ_OPERATIONS = new Set([
  'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
]);

function isEmptyWhere(where: Record<string, unknown> | undefined): boolean {
  if (!where || Object.keys(where).length === 0) return true;

  const isEmptyLogical = (key: 'OR' | 'AND') =>
    where[key] !== undefined &&
    (!Array.isArray(where[key]) || (where[key] as unknown[]).length === 0);

  const isEmptyNot =
    where.NOT !== undefined && typeof where.NOT === 'object' &&
    !Array.isArray(where.NOT) && Object.keys(where.NOT as object).length === 0;

  return isEmptyLogical('OR') || isEmptyLogical('AND') || isEmptyNot;
}

// delete/deleteMany redirecionados para update/updateMany via getExtensionContext,
// pois a extensão de query ($allOperations) não permite trocar a operação executada.
function softDeleteModelMethods(modelName: string) {
  return {
    async findUnique(this: unknown, args: any) {
      const context = Prisma.getExtensionContext(this) as any;
      const where = { ...args?.where };
      if (!('deletedAt' in where)) where.deletedAt = null;
      return context.findFirst({ ...args, where });
    },
    async findUniqueOrThrow(this: unknown, args: any) {
      const context = Prisma.getExtensionContext(this) as any;
      const where = { ...args?.where };
      if (!('deletedAt' in where)) where.deletedAt = null;
      return context.findFirstOrThrow({ ...args, where });
    },
    async delete(this: unknown, args: any) {
      const context = Prisma.getExtensionContext(this) as any;
      return context.update({
        ...args,
        data: { ...args?.data, deletedAt: new Date() },
      });
    },
    async deleteMany(this: unknown, args: any) {
      const context = Prisma.getExtensionContext(this) as any;
      const where = args?.where;
      if (isEmptyWhere(where)) {
        throw new Error(
          `deleteMany sem filtro efetivo em '${modelName}' é proibido — use where explícito ou hardDelete()`,
        );
      }
      return context.updateMany({
        where: { ...where, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    },
  };
}

function createBaseClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

export function createPrismaClient() {
  return createBaseClient().$extends({
    name: 'soft-delete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && SOFT_DELETE_MODELS.has(model) && FILTERED_READ_OPERATIONS.has(operation)) {
            const a = args as { where?: Record<string, unknown> };
            a.where = a.where ?? {};
            if (!('deletedAt' in a.where)) {
              a.where.deletedAt = null;
            }
          }
          return query(args);
        },
      },
    },
    model: {
      user: softDeleteModelMethods('User'),
      project: softDeleteModelMethods('Project'),
      client: softDeleteModelMethods('Client'),
      supplier: softDeleteModelMethods('Supplier'),
      accountCategory: softDeleteModelMethods('AccountCategory'),
      bankAccount: softDeleteModelMethods('BankAccount'),
      creditCard: softDeleteModelMethods('CreditCard'),
      costCenter: softDeleteModelMethods('CostCenter'),
      transaction: softDeleteModelMethods('Transaction'),
    },
  });
}

export type PrismaClientExtended = ReturnType<typeof createPrismaClient>;

// Token de injeção e tipo usados pelos módulos (`constructor(private prisma: PrismaService)`).
// A instância real — com adapter e soft-delete extension — é criada pela factory
// em PrismaModule; esta classe nunca é instanciada diretamente.
export abstract class PrismaService extends PrismaClient {}
