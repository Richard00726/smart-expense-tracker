require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getLedgerBalances(userId, startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date('1970-01-01');
  const end = endDate ? new Date(endDate) : new Date('2099-12-31');

  // 1. UPI Opening Balance
  let upiOpening = 0;
  const lastUpiBefore = await prisma.transaction.findFirst({
    where: {
      userId,
      wallet: 'UPI',
      date: { lt: start }
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
  });

  if (lastUpiBefore && lastUpiBefore.balance !== null) {
    upiOpening = Number(lastUpiBefore.balance);
  } else {
    // If no prior transaction, check the first transaction inside the period
    const firstUpiInPeriod = await prisma.transaction.findFirst({
      where: {
        userId,
        wallet: 'UPI',
        date: { gte: start, lte: end }
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
    });

    if (firstUpiInPeriod && firstUpiInPeriod.balance !== null) {
      if (firstUpiInPeriod.type === 'credit') {
        upiOpening = Number(firstUpiInPeriod.balance) - Number(firstUpiInPeriod.amount);
      } else {
        upiOpening = Number(firstUpiInPeriod.balance) + Number(firstUpiInPeriod.amount);
      }
    } else {
      // Default to UPI wallet balance if no transactions
      const w = await prisma.wallet.findUnique({
        where: { userId_type: { userId, type: 'UPI' } }
      });
      upiOpening = w ? Number(w.balance) : 0;
    }
  }

  // 2. Cash Opening Balance
  const cashPriorCredits = await prisma.transaction.aggregate({
    where: { userId, wallet: 'Cash', type: 'credit', date: { lt: start } },
    _sum: { amount: true }
  });
  const cashPriorDebits = await prisma.transaction.aggregate({
    where: { userId, wallet: 'Cash', type: 'debit', date: { lt: start } },
    _sum: { amount: true }
  });
  const cashOpening = (cashPriorCredits._sum.amount || 0) - (cashPriorDebits._sum.amount || 0);

  // 3. Transactions inside the period
  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: start, lte: end }
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
  });

  let upiIn = 0;
  let upiOut = 0;
  let cashIn = 0;
  let cashOut = 0;

  for (const t of txs) {
    const isCredit = t.type === 'credit' || t.type === 'income';
    const amt = Number(t.amount);
    if (t.wallet === 'UPI') {
      if (isCredit) upiIn += amt;
      else upiOut += amt;
    } else if (t.wallet === 'Cash') {
      if (isCredit) cashIn += amt;
      else cashOut += amt;
    }
  }

  const upiClosing = upiOpening + upiIn - upiOut;
  const cashClosing = cashOpening + cashIn - cashOut;

  const combinedOpening = upiOpening + cashOpening;
  const combinedIn = upiIn + cashIn;
  const combinedOut = upiOut + cashOut;
  const combinedClosing = combinedOpening + combinedIn - combinedOut;

  return {
    upi: { opening: upiOpening, in: upiIn, out: upiOut, closing: upiClosing },
    cash: { opening: cashOpening, in: cashIn, out: cashOut, closing: cashClosing },
    combined: { opening: combinedOpening, in: combinedIn, out: combinedOut, closing: combinedClosing }
  };
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'lourdurajsebastin350@gmail.com' } });
  
  const start = new Date(2026, 9, 1); // Oct 1, 2026 IST
  const end = new Date(2026, 10, 0, 23, 59, 59, 999); // Oct 31, 2026 IST

  const result = await getLedgerBalances(user.id, start.toISOString(), end.toISOString());
  console.log('Result for October 2026:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
