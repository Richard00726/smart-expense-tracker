import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushAutoTransaction, setAuthToken } from './api';

const QUEUE_KEY = '@pending_offline_transactions';

/**
 * Add a transaction to the offline queue
 */
export const queueTransaction = async (transactionData) => {
  try {
    const rawQueue = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = rawQueue ? JSON.parse(rawQueue) : [];

    // Avoid duplicate queue entries if refNo is already in queue
    if (transactionData.refNo) {
      const exists = queue.some(t => t.refNo === transactionData.refNo);
      if (exists) {
        console.log("ℹ️ [SyncQueue]: Transaction already exists in offline queue:", transactionData.refNo);
        return;
      }
    }

    const item = {
      ...transactionData,
      queuedAt: new Date().toISOString(),
    };

    queue.push(item);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`📦 [SyncQueue]: Queued transaction locally (${queue.length} pending).`);
  } catch (err) {
    console.error("❌ [SyncQueue Error] Queueing transaction failed:", err);
  }
};

/**
 * Flush and sync all pending offline transactions to the server
 */
export const syncPendingTransactions = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      console.log("⚠️ [SyncQueue]: Cannot sync, user is not logged in.");
      return { synced: 0, remaining: 0 };
    }

    setAuthToken(token);

    const rawQueue = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = rawQueue ? JSON.parse(rawQueue) : [];

    if (queue.length === 0) {
      return { synced: 0, remaining: 0 };
    }

    console.log(`🔄 [SyncQueue]: Attempting to sync ${queue.length} pending transaction(s)...`);

    const remaining = [];
    let syncedCount = 0;

    for (const txn of queue) {
      try {
        await pushAutoTransaction(txn);
        syncedCount++;
        console.log(`✅ [SyncQueue]: Successfully synced transaction (Amount: ₹${txn.amount})`);
      } catch (error) {
        // If network error / server down, keep in queue for next try
        console.log(`⚠️ [SyncQueue]: Sync failed for transaction, keeping in queue:`, error.message);
        remaining.push(txn);
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    return { synced: syncedCount, remaining: remaining.length };
  } catch (err) {
    console.error("❌ [SyncQueue Error] Sync failed:", err);
    return { synced: 0, remaining: 0 };
  }
};

/**
 * Get count of pending transactions
 */
export const getPendingCount = async () => {
  try {
    const rawQueue = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = rawQueue ? JSON.parse(rawQueue) : [];
    return queue.length;
  } catch (e) {
    return 0;
  }
};
