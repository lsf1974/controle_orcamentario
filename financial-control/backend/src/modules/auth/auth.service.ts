import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { BCRYPT_ROUNDS } from '../../common/constants';

@Injectable()
export class AuthService {
  private static readonly DUMMY_HASH = '$2b$12$dummyhashtopreventtimingattacks1234567890123456';

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash },
      select: { id: true, name: true, email: true, systemRole: true },
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    const hash = user?.isActive ? user.passwordHash : AuthService.DUMMY_HASH;
    const valid = await bcrypt.compare(dto.password, hash);

    if (!user || !user.isActive || !valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens({
      id: user.id,
      name: user.name,
      email: user.email,
      systemRole: user.systemRole,
    });
  }

  async refreshTokens(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido, revogado ou expirado');
    }

    const now = new Date();

    // Token expirado — marcar como revogado para ativar theft detection em tentativas futuras
    if (stored.expiresAt <= now) {
      if (!stored.revokedAt) {
        await this.prisma.refreshToken.updateMany({
          where: { token, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      throw new UnauthorizedException('Refresh token inválido, revogado ou expirado');
    }

    // Token revogado — possível roubo de sessão, revogar toda a chain
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException('Refresh token inválido, revogado ou expirado');
    }

    // Verificar usuário ANTES de revogar — evita queimar token de usuário inativo sem emitir novo
    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException('Usuário inativo');
    }

    // Revogar atomicamente — count=0 indica race condition (outro request ganhou primeiro)
    // Nota: dois requests simultâneos com o mesmo token válido resultam num 401 para o segundo.
    // Isso é o comportamento correto para prevenir replay, mas clientes devem implementar retry.
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { token, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (revoked.count === 0) {
      throw new UnauthorizedException('Refresh token inválido, revogado ou expirado');
    }

    return this.generateTokens({
      id: user.id,
      name: user.name,
      email: user.email,
      systemRole: user.systemRole,
    });
  }

  async logout(userId: string) {
    // Soft-revoke: preserva os registros para theft detection (roubo após logout)
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async generateTokens(user: {
    id: string;
    name: string;
    email: string;
    systemRole: string;
  }) {
    const payload = { sub: user.id, email: user.email, systemRole: user.systemRole };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('jwt.secret'),
      expiresIn: this.config.get('jwt.expiresIn'),
    });

    const refreshTokenValue = randomBytes(40).toString('hex');
    const days = this.config.get<number>('jwt.refreshExpiresInDays') ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Limpar tokens antigos (revogados e expirados) para evitar crescimento ilimitado da tabela
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { revokedAt: { not: null } },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: refreshTokenValue, expiresAt },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: { id: user.id, name: user.name, email: user.email, systemRole: user.systemRole },
    };
  }
}
