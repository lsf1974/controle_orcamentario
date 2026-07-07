import { Global, Module } from '@nestjs/common';
import { createPrismaClient, PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: async () => {
        const prisma = createPrismaClient();
        await prisma.$connect();
        return prisma;
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
