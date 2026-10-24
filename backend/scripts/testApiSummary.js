const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const prisma = new PrismaClient();

async function testSummaryApi() {
  const user = await prisma.user.findFirst({ where: { email: 'lourdurajsebastin350@gmail.com' } });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'your_secret_key');

  const start = new Date(2026, 9, 1);
  const end = new Date(2026, 10, 0, 23, 59, 59, 999);

  try {
    const res = await fetch(`http://localhost:5000/api/summary?startDate=${start.toISOString()}&endDate=${end.toISOString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Flow Ledger returned by API:');
    console.log(JSON.stringify(data.flowLedger, null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testSummaryApi().catch(console.error).finally(() => prisma.$disconnect());
