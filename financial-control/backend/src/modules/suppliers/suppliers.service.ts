import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { throwConflictIfUniqueViolation } from '../../common/utils/prisma-errors';
import { assertPersonNames } from '../../common/utils/person-names.util';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException(`Fornecedor ${id} não encontrado`);
    return supplier;
  }

  async create(dto: CreateSupplierDto) {
    assertPersonNames(dto);
    const exists = await this.prisma.supplier.findFirst({
      where: { taxId: dto.taxId, deletedAt: null },
    });
    if (exists) throw new ConflictException('CPF/CNPJ já cadastrado');
    try {
      return await this.prisma.supplier.create({ data: dto });
    } catch (error) {
      throwConflictIfUniqueViolation(error, 'CPF/CNPJ já cadastrado');
    }
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    if (dto.taxId) {
      const exists = await this.prisma.supplier.findFirst({
        where: { taxId: dto.taxId, deletedAt: null, id: { not: id } },
      });
      if (exists) throw new ConflictException('CPF/CNPJ já cadastrado');
    }
    try {
      return await this.prisma.supplier.update({ where: { id }, data: dto });
    } catch (error) {
      throwConflictIfUniqueViolation(error, 'CPF/CNPJ já cadastrado');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const [txCount, blCount] = await Promise.all([
      this.prisma.transaction.count({ where: { supplierId: id, deletedAt: null } }),
      this.prisma.budgetLine.count({ where: { supplierId: id } }),
    ]);
    if (txCount + blCount > 0) {
      throw new ConflictException(
        'Fornecedor possui lançamentos ou linhas de orçamento vinculados — desative-o (isActive: false) em vez de excluir',
      );
    }
    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
