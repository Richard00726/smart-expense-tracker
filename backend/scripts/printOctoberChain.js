const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'lourdurajsebastin350@gmail.com' }
  });

  const txs = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      date: {
        gte: new Date('2026-09-30T18:30:00.000Z'),
        lte: new Date('2026-10-31T18:29:59.999Z')
      }
    },
    orderBy: [
      { date: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  console.log(`October transactions count: ${txs.length}`);
  console.log('---------------------------------------------------------------------------------------------------------');
  console.log('Index | ID | Date (IST) | Type | Amount | DB Stored Balance | Note');
  console.log('---------------------------------------------------------------------------------------------------------');

  txs.forEach((t, i) => {
    const dStr = new Date(t.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`${String(i+1).padStart(2)} | ${t.id.slice(0, 8)} | ${dStr} | ${t.type.padEnd(6)} | ${String(t.amount).padStart(8)} | ${String(t.balance).padStart(9)} | ${t.note.slice(0, 45)}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
