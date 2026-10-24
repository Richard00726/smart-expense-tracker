const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'processed_statements.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Error creating data directory:', e.message);
  }
}

function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading processed_statements.json:', e.message);
  }
  return {};
}

function saveStore(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving processed_statements.json:', e.message);
  }
}

/**
 * Checks if a statement attachment (by messageId or filename) has already been processed
 */
function isStatementAlreadyProcessed(userId, identifier) {
  if (!userId || !identifier) return false;
  const store = loadStore();
  const userList = store[userId] || [];
  return userList.includes(identifier);
}

/**
 * Marks a statement attachment as processed for this user
 */
function markStatementProcessed(userId, identifier) {
  if (!userId || !identifier) return;
  const store = loadStore();
  if (!store[userId]) {
    store[userId] = [];
  }
  if (!store[userId].includes(identifier)) {
    store[userId].push(identifier);
    saveStore(store);
  }
}

/**
 * Checks if user has already completed the initial full historical inbox ingestion
 */
function hasCompletedFullInboxSync(userId) {
  if (!userId) return false;
  const store = loadStore();
  return Boolean(store[`${userId}_full_synced`]);
}

/**
 * Marks that user has completed the initial full inbox ingestion
 */
function markFullInboxSyncCompleted(userId) {
  if (!userId) return;
  const store = loadStore();
  store[`${userId}_full_synced`] = true;
  saveStore(store);
}

/**
 * Resets full sync state when disconnecting or reconnecting
 */
function resetFullInboxSync(userId) {
  if (!userId) return;
  const store = loadStore();
  delete store[`${userId}_full_synced`];
  saveStore(store);
}

/**
 * Completely clears all processed statement tracking and sync state for a user
 */
function clearUserProcessedStatements(userId) {
  if (!userId) return;
  const store = loadStore();
  delete store[userId];
  delete store[`${userId}_full_synced`];
  saveStore(store);
}

/**
 * Gets all processed identifiers for a user
 */
function getProcessedStatements(userId) {
  const store = loadStore();
  return store[userId] || [];
}

module.exports = {
  isStatementAlreadyProcessed,
  markStatementProcessed,
  getProcessedStatements,
  hasCompletedFullInboxSync,
  markFullInboxSyncCompleted,
  resetFullInboxSync,
  clearUserProcessedStatements
};
