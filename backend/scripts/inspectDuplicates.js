const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tx1 = await prisma.transaction.findUnique({
    where: { id: '2dbf2c3f-76f5-4166-924a-91640571378a' }
  });
  const tx2 = await prisma.transaction.findUnique({
    where: { id: '27624a25-4b36-40a1-9165-d562f4a25248' }
  });
  console.log('Tx1:', JSON.stringify(tx1, null, 2));
  console.log('Tx2:', JSON.stringify(tx2, null, 2));

  // Check all transactions for user in Oct 2026
  const allTx = await prisma.transaction.findMany({
    where: {
      date: {
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lte: new Date('2026-10-31T23:59:59.999Z')
      }
    },
    orderBy: { date: 'asc' }
  });

  console.log('Total Oct transactions:', allTx.length);
  let totalCredit = 0;
  let totalDebit = 0;
  for (const t of allTx) {
    if (t.type === 'income') totalCredit += Number(t.amount);
    if (t.type === 'expense') totalDebit += Number(t.amount);
  }
  console.log('Total Credit (Income):', totalCredit.toFixed(2));
  console.log('Total Debit (Expense):', totalDebit.toFixed(2));
  console.log('Net (Credit - Debit):', (totalCredit - totalDebit).toFixed(2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
