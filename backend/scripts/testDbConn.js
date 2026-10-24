const { PrismaClient } = require('@prisma/client');

async function testUrl(url, label) {
  const p = new PrismaClient({
    datasources: { db: { url } },
    log: ['error']
  });
  try {
    console.log(`Testing ${label}...`);
    const count = await p.transaction.count();
    console.log(`${label}: SUCCESS! Found ${count} transactions.`);
    await p.$disconnect();
    return true;
  } catch (err) {
    console.log(`${label}: FAILED -> ${err.message.split('\n')[0]}`);
    try { await p.$disconnect(); } catch {}
    return false;
  }
}

async function main() {
  const url5432 = 'postgresql://postgres.kcujkhatuvjybgbjdngr:Richart3006200@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?connection_limit=5&pool_timeout=10';
  const url6543 = 'postgresql://postgres.kcujkhatuvjybgbjdngr:Richart3006200@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?connection_limit=5&pool_timeout=10&pgbouncer=true';
  const urlDirect = 'postgresql://postgres:Richart3006200@db.kcujkhatuvjybgbjdngr.supabase.co:5432/postgres?connection_limit=5&pool_timeout=10';

  await testUrl(url5432, 'Pooler 5432');
  await testUrl(url6543, 'Pooler 6543 (pgbouncer)');
  await testUrl(urlDirect, 'Direct 5432');
  process.exit(0);
}

main();
