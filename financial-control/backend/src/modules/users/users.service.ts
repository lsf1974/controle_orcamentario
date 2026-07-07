import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma, SystemRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../../common/constants';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  systemRole: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException(`Usuário ${id} não encontrado`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          systemRole: dto.systemRole,
        },
        select: USER_SELECT,
      });
    } catch (error) {
      // E-mail de um usuário soft-deletado ainda ocupa a constraint única do banco —
      // o findFirst acima não pega esse caso (filtra deletedAt: null), então o conflito
      // só aparece aqui.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    requestingUser: { id: string; systemRole: SystemRole },
  ) {
    if (
      requestingUser.id !== id &&
      requestingUser.systemRole !== SystemRole.ADMIN
    ) {
      throw new ForbiddenException('Acesso negado');
    }
    if (
      dto.systemRole !== undefined &&
      requestingUser.systemRole !== SystemRole.ADMIN
    ) {
      throw new ForbiddenException('Apenas admin pode alterar o perfil de sistema');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.systemRole !== undefined) data.systemRole = dto.systemRole;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    if (dto.systemRole === undefined) {
      await this.findOne(id);
      return this.prisma.user.update({ where: { id }, data, select: USER_SELECT });
    }

    // Troca de systemRole passa por transação serializável: mesma proteção de remove()
    // contra rebaixar o último admin do sistema (inclusive auto-rebaixamento).
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.user.findUnique({
          where: { id, deletedAt: null },
          select: { systemRole: true },
        });
        if (!current) throw new NotFoundException(`Usuário ${id} não encontrado`);

        if (current.systemRole === SystemRole.ADMIN && dto.systemRole !== SystemRole.ADMIN) {
          const remainingAdmins = await tx.user.count({
            where: { systemRole: SystemRole.ADMIN, deletedAt: null, id: { not: id } },
          });
          if (remainingAdmins === 0) {
            throw new BadRequestException(
              'Não é possível remover o perfil de administrador do único administrador do sistema',
            );
          }
        }

        return tx.user.update({ where: { id }, data, select: USER_SELECT });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async remove(id: string) {
    await this.findOne(id); // falha rápida se não existir

    // Transação serializável evita race condition onde dois admins se deletam simultaneamente
    await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id, deletedAt: null },
          select: { systemRole: true },
        });
        if (!user) throw new NotFoundException(`Usuário ${id} não encontrado`);

        if (user.systemRole === SystemRole.ADMIN) {
          const remainingAdmins = await tx.user.count({
            where: { systemRole: SystemRole.ADMIN, deletedAt: null, id: { not: id } },
          });
          if (remainingAdmins === 0) {
            throw new BadRequestException(
              'Não é possível remover o único administrador do sistema',
            );
          }
        }

        await tx.user.update({
          where: { id },
          data: { deletedAt: new Date(), isActive: false },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
