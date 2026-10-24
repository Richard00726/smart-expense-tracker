const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lastSept = await prisma.transaction.findFirst({
    where: { date: { lt: new Date('2026-09-30T18:30:00.000Z') } },
    orderBy: { date: 'desc' }
  });
  console.log('Last Sept transaction:');
  console.log('Date:', lastSept?.date);
  console.log('Amount:', lastSept?.amount, 'Type:', lastSept?.type);
  console.log('Closing Balance as of Sept 30:', lastSept?.balance);

  const startBalance = lastSept?.balance || 1004.23;
  console.log('\n--- OCT RECONCILIATION ---');
  console.log('October Starting Balance:', startBalance);
  console.log('October Inflow (+):', 81259.00);
  console.log('October Outflow (-):', 81615.20);
  const calculatedEnding = startBalance + 81259.00 - 81615.20;
  console.log('Calculated Ending Balance:', calculatedEnding.toFixed(2));

  const currentWallet = await prisma.wallet.findFirst({
    where: { type: 'UPI' }
  });
  console.log('Actual Wallet Balance in DB:', currentWallet.balance);
  console.log('Difference (Calculated - Actual):', (calculatedEnding - currentWallet.balance).toFixed(2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
