import { BadRequestException } from '@nestjs/common';
import { PersonType } from '@prisma/client';

/**
 * Valida a obrigatoriedade condicional de nome por tipo de pessoa.
 * Chamado APENAS no create — no update, exigir o campo de novo quebraria
 * PATCHes que reenviam personType sem alterar o nome já salvo.
 */
export function assertPersonNames(dto: {
  personType?: PersonType;
  companyName?: string | null;
  fullName?: string | null;
}): void {
  if (dto.personType === PersonType.COMPANY && !dto.companyName) {
    throw new BadRequestException(
      'Razão social (companyName) é obrigatória para pessoa jurídica',
    );
  }
  if (dto.personType === PersonType.INDIVIDUAL && !dto.fullName) {
    throw new BadRequestException(
      'Nome completo (fullName) é obrigatório para pessoa física',
    );
  }
}
