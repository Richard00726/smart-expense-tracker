require('dotenv').config();
const dns = require('node:dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch {}
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
