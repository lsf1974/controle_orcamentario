import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.bankAccount.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id, deletedAt: null },
    });
    if (!account)
      throw new NotFoundException(`Conta bancária ${id} não encontrada`);
    return account;
  }

  async create(dto: CreateBankAccountDto) {
    const { initialDate, ...rest } = dto;
    return this.prisma.bankAccount.create({
      data: { ...rest, initialDate: new Date(initialDate) },
    });
  }

  async update(id: string, dto: UpdateBankAccountDto) {
    await this.findOne(id);
    const { initialDate, ...rest } = dto;
    return this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...rest,
        ...(initialDate ? { initialDate: new Date(initialDate) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // BankStatement não tem deletedAt no schema — contar sem filtro
    const [txCount, stmtCount, cardCount] = await Promise.all([
      this.prisma.transaction.count({
        where: { bankAccountId: id, deletedAt: null },
      }),
      this.prisma.bankStatement.count({ where: { bankAccountId: id } }),
      this.prisma.creditCard.count({
        where: { paymentAccountId: id, deletedAt: null },
      }),
    ]);
    if (txCount + stmtCount + cardCount > 0) {
      throw new ConflictException(
        'Conta bancária possui lançamentos, extratos ou cartões vinculados — desative-a (isActive: false) em vez de excluir',
      );
    }
    await this.prisma.bankAccount.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findByProject(projectId: string) {
    const rows = await this.prisma.projectBankAccount.findMany({
      where: { projectId, bankAccount: { deletedAt: null } },
      include: { bankAccount: true },
    });
    return rows.map((r) => r.bankAccount);
  }

  async assignToProject(projectId: string, bankAccountId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Projeto ${projectId} não encontrado`);

    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, deletedAt: null },
    });
    if (!account)
      throw new NotFoundException(
        `Conta bancária ${bankAccountId} não encontrada`,
      );

    const existing = await this.prisma.projectBankAccount.findUnique({
      where: { projectId_bankAccountId: { projectId, bankAccountId } },
    });
    if (existing)
      throw new ConflictException('Conta bancária já está associada ao projeto');

    return this.prisma.projectBankAccount.create({
      data: { projectId, bankAccountId },
    });
  }

  async unassignFromProject(projectId: string, bankAccountId: string) {
    const pba = await this.prisma.projectBankAccount.findUnique({
      where: { projectId_bankAccountId: { projectId, bankAccountId } },
    });
    if (!pba)
      throw new NotFoundException('Conta bancária não está associada ao projeto');

    // BudgetLine não referencia conta bancária — só Transaction bloqueia
    const txCount = await this.prisma.transaction.count({
      where: { projectId, bankAccountId, deletedAt: null },
    });
    if (txCount > 0) {
      throw new ConflictException(
        'Conta bancária possui lançamentos neste projeto — não é possível desassociar',
      );
    }

    await this.prisma.projectBankAccount.delete({
      where: { projectId_bankAccountId: { projectId, bankAccountId } },
    });
  }
}
