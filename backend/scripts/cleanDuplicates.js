const prisma = require('../prismaClient');

async function deduplicate() {
  const txs = await prisma.transaction.findMany({
    orderBy: { createdAt: 'asc' }
  });

  const seen = new Set();
  const toDelete = [];

  for (const t of txs) {
    const day = new Date(t.txnDate || t.date).toISOString().slice(0, 10);
    // Key uses refNo if available, otherwise exact combination of user + wallet + type + amount + day + balance + note
    const key = t.refNo
      ? `ref_${t.userId}_${t.refNo}`
      : `sig_${t.userId}_${t.wallet}_${t.type}_${t.amount}_${day}_${t.balance}_${(t.note || '').trim()}`;

    if (seen.has(key)) {
      toDelete.push(t.id);
    } else {
      seen.add(key);
    }
  }

  console.log('Total transactions examined:', txs.length);
  console.log('Duplicate IDs found to remove:', toDelete.length);

  if (toDelete.length > 0) {
    const res = await prisma.transaction.deleteMany({
      where: { id: { in: toDelete } }
    });
    console.log('Successfully deleted duplicate records:', res.count);
  } else {
    console.log('No duplicates found.');
  }

  const remaining = await prisma.transaction.findMany({
    where: { wallet: 'UPI' },
    orderBy: { createdAt: 'asc' }
  });
  console.log('Remaining UPI transactions:', remaining.length);
}

deduplicate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
