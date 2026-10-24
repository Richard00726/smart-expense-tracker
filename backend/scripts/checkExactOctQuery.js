const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'lourdurajsebastin350@gmail.com' }
  });

  // Exactly what frontend sends:
  const year = 2026;
  const month = 10;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  console.log('Query start (ISO):', start.toISOString());
  console.log('Query end (ISO):', end.toISOString());

  const txs = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      date: {
        gte: start,
        lte: end
      }
    },
    orderBy: { date: 'asc' }
  });

  console.log(`October Transactions in range: ${txs.length}`);

  let income = 0;
  let spend = 0;
  for (const t of txs) {
    if (t.type === 'credit') income += t.amount;
    else spend += t.amount;
  }
  console.log('Total Income (Credits):', income.toFixed(2));
  console.log('Total Spend (Debits):', spend.toFixed(2));
  console.log('Net Flow (Income - Spend):', (income - spend).toFixed(2));

  // Now calculate without the duplicate 27624a25-4b36-40a1-9165-d562f4a25248
  const cleanTxs = txs.filter(t => t.id !== '27624a25-4b36-40a1-9165-d562f4a25248');
  let cleanIncome = 0;
  let cleanSpend = 0;
  for (const t of cleanTxs) {
    if (t.type === 'credit') cleanIncome += t.amount;
    else cleanSpend += t.amount;
  }
  console.log('\n--- CLEAN (WITHOUT DUPLICATE) ---');
  console.log('Clean Count:', cleanTxs.length);
  console.log('Clean Income (Credits):', cleanIncome.toFixed(2));
  console.log('Clean Spend (Debits):', cleanSpend.toFixed(2));
  console.log('Clean Net Flow:', (cleanIncome - cleanSpend).toFixed(2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
