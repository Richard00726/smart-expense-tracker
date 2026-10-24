require('dotenv').config();
const prisma = require('../prismaClient');

async function check() {
  const user = await prisma.user.findUnique({
    where: { email: 'lourdurajsebastin350@gmail.com' }
  });
  console.log('User found:', user.email, 'ID:', user.id);

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { date: 'asc' }
  });

  console.log('Total user transactions:', transactions.length);

  const monthMap = {};
  for (const t of transactions) {
    const dStr = t.date.toISOString().slice(0, 7);
    if (!monthMap[dStr]) {
      monthMap[dStr] = { count: 0, upi: 0, cash: 0, auto: 0, manual: 0, minDate: t.date, maxDate: t.date };
    }
    monthMap[dStr].count++;
    if (t.wallet === 'UPI') monthMap[dStr].upi++;
    if (t.wallet === 'Cash') monthMap[dStr].cash++;
    if (t.entryMode === 'auto') monthMap[dStr].auto++;
    if (t.entryMode === 'manual') monthMap[dStr].manual++;
    if (t.date > monthMap[dStr].maxDate) monthMap[dStr].maxDate = t.date;
  }

  console.log('Transaction breakdown by month:');
  console.table(monthMap);

  const latestUpi = await prisma.transaction.findFirst({
    where: { userId: user.id, wallet: 'UPI' },
    orderBy: { date: 'desc' }
  });
  console.log('Latest UPI Transaction in DB:', latestUpi);

  const wallets = await prisma.wallet.findMany({ where: { userId: user.id } });
  console.log('Wallets:', wallets);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
