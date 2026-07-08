import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCreditCardDto } from './dto/create-credit-card.dto';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto';

@Injectable()
export class CreditCardsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.creditCard.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const card = await this.prisma.creditCard.findFirst({
      where: { id, deletedAt: null },
    });
    if (!card) throw new NotFoundException(`Cartão ${id} não encontrado`);
    return card;
  }

  private async assertPaymentAccount(paymentAccountId?: string) {
    if (!paymentAccountId) return;
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: paymentAccountId, deletedAt: null },
      select: { id: true },
    });
    if (!account)
      throw new NotFoundException(
        `Conta bancária ${paymentAccountId} não encontrada`,
      );
  }

  async create(dto: CreateCreditCardDto) {
    await this.assertPaymentAccount(dto.paymentAccountId);
    return this.prisma.creditCard.create({ data: dto });
  }

  async update(id: string, dto: UpdateCreditCardDto) {
    await this.findOne(id);
    await this.assertPaymentAccount(dto.paymentAccountId);
    return this.prisma.creditCard.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // BudgetLine não referencia cartão — só Transaction bloqueia
    const txCount = await this.prisma.transaction.count({
      where: { creditCardId: id, deletedAt: null },
    });
    if (txCount > 0) {
      throw new ConflictException(
        'Cartão possui lançamentos vinculados — desative-o (isActive: false) em vez de excluir',
      );
    }
    await this.prisma.creditCard.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findByProject(projectId: string) {
    const rows = await this.prisma.projectCreditCard.findMany({
      where: { projectId, creditCard: { deletedAt: null } },
      include: { creditCard: true },
    });
    return rows.map((r) => r.creditCard);
  }

  async assignToProject(projectId: string, creditCardId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Projeto ${projectId} não encontrado`);

    const card = await this.prisma.creditCard.findFirst({
      where: { id: creditCardId, deletedAt: null },
    });
    if (!card)
      throw new NotFoundException(`Cartão ${creditCardId} não encontrado`);

    const existing = await this.prisma.projectCreditCard.findUnique({
      where: { projectId_creditCardId: { projectId, creditCardId } },
    });
    if (existing)
      throw new ConflictException('Cartão já está associado ao projeto');

    return this.prisma.projectCreditCard.create({
      data: { projectId, creditCardId },
    });
  }

  async unassignFromProject(projectId: string, creditCardId: string) {
    const pcc = await this.prisma.projectCreditCard.findUnique({
      where: { projectId_creditCardId: { projectId, creditCardId } },
    });
    if (!pcc)
      throw new NotFoundException('Cartão não está associado ao projeto');

    const txCount = await this.prisma.transaction.count({
      where: { projectId, creditCardId, deletedAt: null },
    });
    if (txCount > 0) {
      throw new ConflictException(
        'Cartão possui lançamentos neste projeto — não é possível desassociar',
      );
    }

    await this.prisma.projectCreditCard.delete({
      where: { projectId_creditCardId: { projectId, creditCardId } },
    });
  }
}
