import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('token') } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.secret') return 'test-secret';
              if (key === 'jwt.refreshSecret') return 'test-refresh-secret';
              if (key === 'jwt.expiresIn') return '15m';
              if (key === 'jwt.refreshExpiresInDays') return 7;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: '1', email: 'a@b.com' });

      await expect(
        service.register({ name: 'Test', email: 'a@b.com', password: 'Pass@123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user and return tokens', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        name: 'Test',
        email: 'a@b.com',
        systemRole: 'USER',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        name: 'Test',
        email: 'a@b.com',
        password: 'Pass@123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'x@y.com', password: '123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        passwordHash: await bcrypt.hash('correct', 10),
        isActive: true,
        systemRole: 'USER',
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens for valid credentials', async () => {
      const hash = await bcrypt.hash('Pass@123', 10);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: hash,
        isActive: true,
        systemRole: 'USER',
        name: 'Test',
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'a@b.com', password: 'Pass@123' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException if token is not valid/active', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should revoke all tokens on reuse detection and throw', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        userId: 'user-1',
        revokedAt: new Date(),
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 1 });

      await expect(service.refreshTokens('stolen-token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledTimes(2);
    });

    it('should generate new tokens for valid refresh token', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Test',
        email: 'a@b.com',
        systemRole: 'USER',
        isActive: true,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens('valid-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('logout', () => {
    it('should delete all refresh tokens for user', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      await service.logout('user-1');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });
});
