import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('ADMIN_EMAIL or ADMIN_PASSWORD missing; skipping admin seed.');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, role: 'ADMIN' },
    create: {
      name: 'Administrator',
      email: email.toLowerCase(),
      passwordHash,
      role: 'ADMIN',
      credits: 100
    }
  });
  console.log(`Admin ready: ${email.toLowerCase()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => prisma.$disconnect());
