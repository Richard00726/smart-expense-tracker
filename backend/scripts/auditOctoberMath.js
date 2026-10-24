const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getBankOverview } = require('../services/bankOverviewStore');

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'lourdurajsebastin350@gmail.com' }
  });

  const txs = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      date: {
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lte: new Date('2026-10-31T23:59:59.999Z')
      }
    },
    orderBy: { date: 'asc' }
  });

  console.log(`October Transactions Count: ${txs.length}`);

  let creditWithDup = 0;
  let debitWithDup = 0;

  for (const t of txs) {
    const isCredit = t.type === 'credit' || t.type === 'income';
    const amt = Number(t.amount);
    if (isCredit) {
      creditWithDup += amt;
    } else {
      debitWithDup += amt;
    }
  }

  console.log('--- WITH DUPLICATE ---');
  console.log('Total October Inflow (Credits):', creditWithDup.toFixed(2));
  console.log('Total October Outflow (Debits):', debitWithDup.toFixed(2));
  console.log('Net October Flow:', (creditWithDup - debitWithDup).toFixed(2));

  // Without the duplicate
  const txsClean = txs.filter(t => t.id !== '27624a25-4b36-40a1-9165-d562f4a25248');
  let creditClean = 0;
  let debitClean = 0;

  for (const t of txsClean) {
    const isCredit = t.type === 'credit' || t.type === 'income';
    const amt = Number(t.amount);
    if (isCredit) {
      creditClean += amt;
    } else {
      debitClean += amt;
    }
  }

  console.log('\n--- WITHOUT DUPLICATE (CLEAN) ---');
  console.log('Clean Oct Transactions Count:', txsClean.length);
  console.log('Total October Inflow (Credits):', creditClean.toFixed(2));
  console.log('Total October Outflow (Debits):', debitClean.toFixed(2));
  console.log('Net October Flow:', (creditClean - debitClean).toFixed(2));

  const overview = getBankOverview();
  console.log('\n--- BANK STATEMENTS OVERVIEW STORE ---');
  if (overview && overview.dailySummaries) {
    const dates = Object.keys(overview.dailySummaries).sort();
    console.log('First available statement date:', dates[0], overview.dailySummaries[dates[0]]);
    console.log('Last available statement date:', dates[dates.length - 1], overview.dailySummaries[dates[dates.length - 1]]);
  }

  // Check user wallets
  const wallets = await prisma.wallet.findMany({ where: { userId: user.id } });
  console.log('\n--- USER WALLETS IN DB ---');
  console.log(wallets);
}

main().catch(console.error).finally(() => prisma.$disconnect());
