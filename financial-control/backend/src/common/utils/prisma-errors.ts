import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Converte violação de constraint única (P2002) em 409 Conflict;
 * relança qualquer outro erro. Necessário porque registros soft-deletados
 * ainda ocupam as constraints únicas do banco — o findFirst com
 * deletedAt: null não detecta esses casos.
 */
export function throwConflictIfUniqueViolation(
  error: unknown,
  message: string,
): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(message);
  }
  throw error;
}
