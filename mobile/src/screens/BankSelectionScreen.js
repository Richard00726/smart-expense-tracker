import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { syncPendingTransactions, getPendingCount } from '../services/syncQueue';

export default function BankSelectionScreen({ navigation }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const checkQueue = async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  };

  useEffect(() => {
    checkQueue();
    // Try syncing whenever the screen opens
    handleSync();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    const result = await syncPendingTransactions();
    await checkQueue();
    setIsSyncing(false);

    if (result.synced > 0) {
      Alert.alert("Sync Successful", `Synced ${result.synced} offline transaction(s) to your dashboard!`);
    } else if (result.remaining > 0) {
      Alert.alert("Sync Incomplete", `Could not reach server. ${result.remaining} transaction(s) still queued locally.`);
    } else {
      Alert.alert("All Synced", "No pending offline transactions found.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Linked Bank</Text>

        <View style={styles.bankCard}>
          <View style={styles.bankIcon}>
            <Text style={styles.bankIconText}>TMB</Text>
          </View>
          <View style={styles.bankInfo}>
            <Text style={styles.bankName}>Tamilnad Mercantile Bank</Text>
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Active — Listening</Text>
            </View>
          </View>
        </View>

        {/* Offline Queue Sync Card */}
        <View style={styles.syncCard}>
          <View style={styles.syncInfo}>
            <Text style={styles.syncTitle}>Offline Sync Status</Text>
            <Text style={styles.syncSubtitle}>
              {pendingCount === 0 
                ? "🟢 All captured transactions are synced." 
                : `📦 ${pendingCount} transaction(s) saved offline.`}
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.syncButton, isSyncing && { opacity: 0.7 }]} 
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.syncButtonText}>Sync Now</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            When TMB sends a payment notification to your phone (credit or debit), 
            this app will automatically capture it.
            {"\n\n"}
            Even if you are offline or away from Wi-Fi, transactions are safely saved on your phone and will automatically sync the moment you reconnect!
          </Text>
        </View>

        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonText}>
            🏦 More banks (SBI, HDFC, ICICI, Axis, Kotak, PNB) coming in Phase 2
          </Text>
        </View>

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back to Setup</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 16,
  },
  bankIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  bankIconText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  activeText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '500',
  },
  syncCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  syncInfo: {
    flex: 1,
    marginRight: 12,
  },
  syncTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  syncSubtitle: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  syncButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  infoBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginBottom: 20,
  },
  infoTitle: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  infoText: {
    color: '#cbd5e1',
    lineHeight: 22,
    fontSize: 14,
  },
  comingSoon: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    marginBottom: 20,
  },
  comingSoonText: {
    color: '#f59e0b',
    fontSize: 13,
    textAlign: 'center',
  },
  backButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  backButtonText: {
    color: '#94a3b8',
    fontSize: 15,
  },
});
