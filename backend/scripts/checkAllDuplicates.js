const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllDuplicates() {
  const txs = await prisma.transaction.findMany({
    orderBy: { date: 'asc' }
  });

  console.log(`Total transactions in DB: ${txs.length}`);

  const byRef = {};
  const bySig = {};
  const duplicates = [];

  for (const t of txs) {
    const refKey = t.refNo ? `ref_${t.userId}_${t.refNo}` : null;
    const day = new Date(t.txnDate || t.date).toISOString().slice(0, 10);
    const amount = Number(t.amount).toFixed(2);
    const type = (t.type || 'debit').toLowerCase();
    const balance = t.balance != null ? Number(t.balance).toFixed(2) : 'nobal';
    const note = (t.note || '').trim().replace(/\s+/g, ' ');
    const sigKey = `sig_${t.userId}_${day}_${type}_${amount}_${balance}_${note}`;

    let isDup = false;
    if (refKey) {
      if (byRef[refKey]) {
        duplicates.push({ reason: 'Duplicate refNo: ' + t.refNo, original: byRef[refKey], dup: t });
        isDup = true;
      } else {
        byRef[refKey] = t;
      }
    }

    if (!isDup) {
      if (bySig[sigKey]) {
        duplicates.push({ reason: 'Duplicate signature: ' + sigKey, original: bySig[sigKey], dup: t });
      } else {
        bySig[sigKey] = t;
      }
    }
  }

  console.log(`Found ${duplicates.length} duplicate transactions.`);
  for (const d of duplicates) {
    console.log(`- [${d.reason}] ID: ${d.dup.id}, Amount: ${d.dup.amount}, Date: ${d.dup.date}, Note: ${d.dup.note}`);
  }

  return duplicates;
}

checkAllDuplicates().catch(console.error).finally(() => prisma.$disconnect());
