import React, { useState, useEffect } from 'react';
import { Wallet, Landmark, Coins, Zap, ArrowRight } from 'lucide-react';
import { getCurrency, getBankSyncSettings } from '../services/api';

const Dashboard = ({ balances, onOpenSetupGuide }) => {
  const [syncStatus, setSyncStatus] = useState(() => {
    try {
      const cached = localStorage.getItem('bank_sync_settings_cache');
      if (cached) {
        const data = JSON.parse(cached);
        const isConnected = Boolean(data.hasPassword && (data.hasGoogleAuth || data.bankSyncActive || data.lastBankSyncAt));
        return { isConnected, loading: false, email: data.googleEmail };
      }
    } catch (e) {}
    return { isConnected: false, loading: true };
  });

  const checkSyncStatus = async () => {
    try {
      const res = await getBankSyncSettings();
      const data = res.data;
      try {
        localStorage.setItem('bank_sync_settings_cache', JSON.stringify(data));
      } catch (e) {}
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
    <div className="balance-grid animate-fade-in">
      <div className="card balance-card">
        <div className="card-top">
          <span className="card-title">
            <Landmark size={18} strokeWidth={2} />
            Total Balance
          </span>
        </div>
        <div className="card-amount">
          {getCurrency()}{Number(balances.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="card-footer">
          <span>Combined Cash & Bank Balance</span>
        </div>
      </div>
      
      <div className="card balance-card">
        <div className="card-top">
          <span className="card-title">
            <Coins size={18} strokeWidth={2} />
            Cash Balance
          </span>
        </div>
        <div className="card-amount">
          {getCurrency()}{Number(balances.cash || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="card-footer">
          <span>Manual entry wallet</span>
        </div>
      </div>
      
      <div className="card balance-card">
        <div className="card-top">
          <span className="card-title">
            <Wallet size={18} strokeWidth={2} />
            UPI Balance
          </span>
          {syncStatus.isConnected ? (
            <div 
              className="live-sync-pill" 
              onClick={onOpenSetupGuide}
              title="TMB Bank Auto-Sync Connected & Active. Click to open Bank Sync Hub."
              style={{ cursor: 'pointer' }}
            >
              <span className="pulse-dot"></span>
              <span>Live Auto-Sync</span>
            </div>
          ) : (
            <div 
              className="live-sync-pill" 
              onClick={onOpenSetupGuide}
              title="Bank sync is not configured yet. Click to setup."
              style={{ cursor: 'pointer', background: 'var(--bg-card-subtle)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)' }}></span>
              <span>Sync Inactive</span>
            </div>
          )}
        </div>
        <div className="card-amount">
          {getCurrency()}{Number(balances.upi || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="card-footer" style={syncStatus.isConnected ? { color: 'var(--success)', fontWeight: 600 } : {}}>
          {syncStatus.isConnected ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <Zap size={13} strokeWidth={2.5} />
              TMB Bank Auto-Sync Active
            </span>
          ) : (
            <span 
              onClick={onOpenSetupGuide}
              style={{ color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
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
