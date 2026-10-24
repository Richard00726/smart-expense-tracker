import React, { useState, useEffect } from 'react';
import { Wallet, Landmark, Coins, Zap, ArrowRight } from 'lucide-react';
import { getCurrency, getBankSyncSettings } from '../services/api';

const Dashboard = ({ balances, onOpenSetupGuide }) => {
  const [syncStatus, setSyncStatus] = useState({ isConnected: false, loading: true });

  const checkSyncStatus = async () => {
    try {
      const res = await getBankSyncSettings();
      const data = res.data;
      // Only considered connected when user has saved password AND active sync / statement history
      const isConnected = Boolean(data.hasPassword && (data.hasGoogleAuth || data.bankSyncActive || data.lastBankSyncAt));
      setSyncStatus({ isConnected, loading: false, email: data.googleEmail });
    } catch {
      setSyncStatus({ isConnected: false, loading: false });
    }
  };

  useEffect(() => {
    checkSyncStatus();
    window.addEventListener('bank_sync_updated', checkSyncStatus);
    return () => window.removeEventListener('bank_sync_updated', checkSyncStatus);
  }, []);

  return (
    <div className="dashboard-grid animate-fade-in">
      <div className="balance-card glass">
        <div className="card-title">
          <Landmark size={20} className="text-accent-primary" />
          Total Balance
        </div>
        <div className="card-amount">{getCurrency()}{Number(balances.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className="upi-card-footer">
          <span className="footer-tag">Combined Cash & Bank Balance</span>
        </div>
      </div>
      
      <div className="balance-card cash glass">
        <div className="card-title">
          <Coins size={20} className="text-success" />
          Cash Balance
        </div>
        <div className="card-amount">{getCurrency()}{Number(balances.cash || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className="upi-card-footer">
          <span className="footer-tag">Manual entry wallet</span>
        </div>
      </div>
      
      <div className="balance-card upi glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title" style={{ margin: 0 }}>
            <Wallet size={20} className="text-accent-secondary" />
            UPI Balance
          </div>
          {syncStatus.isConnected ? (
            <div 
              className="upi-live-pill" 
              onClick={onOpenSetupGuide}
              title="TMB Bank Auto-Sync Connected & Active. Click to open Bank Sync Hub."
            >
              <span className="pulse-dot-green"></span>
              <span>Live Auto-Sync</span>
            </div>
          ) : (
            <div 
              className="upi-inactive-pill" 
              onClick={onOpenSetupGuide}
              title="Bank sync is not configured yet. Click to setup."
            >
              <span className="dot-inactive"></span>
              <span>Sync Inactive</span>
            </div>
          )}
        </div>
        <div className="card-amount">{getCurrency()}{Number(balances.upi || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className="upi-card-footer">
          {syncStatus.isConnected ? (
            <span className="footer-tag" style={{ color: '#10b981', fontWeight: 500 }}>
              <Zap size={12} color="#10b981" /> TMB Bank Auto-Sync Active
            </span>
          ) : (
            <span 
              className="footer-tag" 
              onClick={onOpenSetupGuide}
              style={{ color: 'var(--text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              Setup Bank Auto-Sync <ArrowRight size={11} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
