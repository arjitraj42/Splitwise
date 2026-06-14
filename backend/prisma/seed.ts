import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Clean existing records (Optional, clean for a fresh seed)
  await prisma.expenseSplit.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.groupMembership.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash('password123', 10);

  // 2. Create the 6 core users
  const usersData = [
    { name: 'Aisha', email: 'aisha@example.com' },
    { name: 'Rohan', email: 'rohan@example.com' },
    { name: 'Priya', email: 'priya@example.com' },
    { name: 'Meera', email: 'meera@example.com' },
    { name: 'Dev', email: 'dev@example.com' },
    { name: 'Sam', email: 'sam@example.com' },
  ];

  const users: Record<string, any> = {};

  for (const u of usersData) {
    const created = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash,
      },
    });
    users[u.name.toLowerCase()] = created;
    console.log(`Created User: ${created.name}`);
  }

  // 3. Create Default Group
  const group = await prisma.group.create({
    data: {
      name: 'Apartment 402',
    },
  });
  console.log(`Created Group: ${group.name} (ID: ${group.id})`);

  // 4. Create Historical Memberships
  // Aisha, Rohan, Priya, Dev: Active since Jan 1, 2026
  // Meera: Jan 1, 2026 -> March 31, 2026
  // Sam: Active since April 15, 2026
  const memberships = [
    { name: 'aisha', joined: '2026-01-01', left: null },
    { name: 'rohan', joined: '2026-01-01', left: null },
    { name: 'priya', joined: '2026-01-01', left: null },
    { name: 'dev', joined: '2026-01-01', left: null },
    { name: 'meera', joined: '2026-01-01', left: '2026-03-31T00:00:00.000Z' },
    { name: 'sam', joined: '2026-04-15', left: null },
  ];

  for (const m of memberships) {
    const user = users[m.name];
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: user.id,
        joinedAt: new Date(m.joined),
        leftAt: m.left ? new Date(m.left) : null,
      },
    });
    console.log(`Joined Member: ${user.name} (Joined: ${m.joined}, Left: ${m.left || 'Active'})`);
  }

  // 5. Seed some sample historical expenses to verify balance logic instantly
  // Jan 15: Aisha pays ₹1200 for electricity split equally (includes Aisha, Rohan, Priya, Dev, Meera - Sam is not active yet)
  const janExp = await prisma.expense.create({
    data: {
      groupId: group.id,
      paidById: users.aisha.id,
      amount: 1200,
      currency: 'INR',
      amountInInr: 1200,
      exchangeRate: 1.0,
      description: 'Electricity Bill Jan',
      date: new Date('2026-01-15'),
      splitType: 'EQUAL',
      splits: {
        create: [
          { userId: users.aisha.id, shareAmount: 240 },
          { userId: users.rohan.id, shareAmount: 240 },
          { userId: users.priya.id, shareAmount: 240 },
          { userId: users.dev.id, shareAmount: 240 },
          { userId: users.meera.id, shareAmount: 240 },
        ],
      },
    },
  });
  console.log(`Seeded Expense: ${janExp.description}`);

  // May 1: Rohan pays ₹1000 for groceries split equally (includes Aisha, Rohan, Priya, Dev, Sam - Meera has left)
  const mayExp = await prisma.expense.create({
    data: {
      groupId: group.id,
      paidById: users.rohan.id,
      amount: 1000,
      currency: 'INR',
      amountInInr: 1000,
      exchangeRate: 1.0,
      description: 'Groceries May',
      date: new Date('2026-05-01'),
      splitType: 'EQUAL',
      splits: {
        create: [
          { userId: users.aisha.id, shareAmount: 200 },
          { userId: users.rohan.id, shareAmount: 200 },
          { userId: users.priya.id, shareAmount: 200 },
          { userId: users.dev.id, shareAmount: 200 },
          { userId: users.sam.id, shareAmount: 200 },
        ],
      },
    },
  });
  console.log(`Seeded Expense: ${mayExp.description}`);

  // 6. Reset PostgreSQL sequences so that subsequent manual entries do not conflict with autoincrement keys
  const tables = ['users', 'groups', 'group_memberships', 'expenses', 'expense_splits', 'settlements', 'import_batches', 'import_anomalies'];
  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(`SELECT setval('${t}_id_seq', COALESCE((SELECT MAX(id) FROM ${t}), 1));`);
    } catch (err) {
      // Ignore sequence reset if database does not support them or is not PostgreSQL
    }
  }

  console.log('Database seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
