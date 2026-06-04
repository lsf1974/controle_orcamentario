import 'dotenv/config';
import { PrismaClient, SystemRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = 'admin@financialcontrol.dev';
  const exists = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (exists) {
    console.log('Seed já executado — admin já existe.');
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: adminEmail,
      passwordHash,
      systemRole: SystemRole.ADMIN,
    },
  });

  console.log(`Admin criado: ${admin.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
