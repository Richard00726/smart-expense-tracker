const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
  const email = "infantrichart06@gmail.com"; // Corrected email without the extra @
  
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log("User not found in database.");
      process.exit(1);
    }
    
    const hashedPassword = await bcrypt.hash("password123", 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });
    console.log("Password successfully reset to: password123");
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}
reset();
