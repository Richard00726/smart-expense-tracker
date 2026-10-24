const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteDuplicate() {
  const dupId = '27624a25-4b36-40a1-9165-d562f4a25248';
  const exists = await prisma.transaction.findUnique({ where: { id: dupId } });
  
  if (exists) {
    console.log('Deleting duplicate transaction:', exists.id, exists.note, exists.amount);
    await prisma.transaction.delete({ where: { id: dupId } });
    console.log('Successfully deleted duplicate transaction.');
  } else {
    console.log('Transaction already deleted or does not exist.');
  }

  // Ensure UPI wallet balance is 648.03
  const user = await prisma.user.findFirst({
    where: { email: 'lourdurajsebastin350@gmail.com' }
  });

  const wallet = await prisma.wallet.findUnique({
    where: { userId_type: { userId: user.id, type: 'UPI' } }
  });
  console.log('Current UPI wallet balance:', wallet?.balance);

  const totalTx = await prisma.transaction.count({ where: { userId: user.id } });
  console.log('Total user transactions remaining:', totalTx);
}

deleteDuplicate().catch(console.error).finally(() => prisma.$disconnect());
