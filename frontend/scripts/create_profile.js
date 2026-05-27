// Create profile helper for PumpX
// Usage: node -r dotenv/config scripts/create_profile.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ADDRESS = process.env.ADDRESS || '0x0eb9fe9677e592ef'.toLowerCase();
const USERNAME = process.env.USERNAME || 'booz';
const AVATAR = process.env.AVATAR || '🚀';

async function main() {
  const addr = ADDRESS.startsWith('0x') ? ADDRESS.toLowerCase() : `0x${ADDRESS}`.toLowerCase();

  await prisma.user.upsert({
    where: { address: addr },
    update: {},
    create: { address: addr, role: 'USER' },
  });

  await prisma.userProfile.upsert({
    where: { address: addr },
    update: { username: USERNAME, avatarUrl: AVATAR },
    create: { address: addr, username: USERNAME, avatarUrl: AVATAR },
  });

  console.log('Profile created/updated for', addr, USERNAME, AVATAR);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
