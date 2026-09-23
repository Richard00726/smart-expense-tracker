import React from 'react';
import { Wallet, Smartphone, Landmark, Coins, Info } from 'lucide-react';
import { getCurrency } from '../services/api';

const Dashboard = ({ balances }) => {
  return (
    <div className="dashboard-grid animate-fade-in">
      <div className="balance-card glass">
        <div className="card-title">
          <Landmark size={20} className="text-accent-primary" />
          Total Balance
        </div>
        <div className="card-amount">{getCurrency()}{balances.total.toLocaleString()}</div>
      </div>
      
      <div className="balance-card cash glass">
        <div className="card-title">
          <Coins size={20} className="text-success" />
          Cash Balance
        </div>
        <div className="card-amount">{getCurrency()}{balances.cash.toLocaleString()}</div>
      </div>
      
      <div className="balance-card upi glass">
        <div className="card-title">
          <Wallet size={20} className="text-accent-secondary" />
          UPI Balance
        </div>
        <div className="card-amount">{getCurrency()}{balances.upi.toLocaleString()}</div>
      </div>

      <div className="automation-card glass" style={{ gridColumn: '1 / -1', marginTop: '1rem', padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start', background: 'var(--card-bg)' }}>
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '12px' }}>
          <Smartphone size={32} color="#3b82f6" />
        </div>
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Automate UPI Tracking 🚀
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: '1.5' }}>
            Tired of entering UPI transactions manually? Install our companion Android app! 
            It runs securely in the background, reads your bank payment notifications, and automatically syncs them here.
          </p>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => alert("To install the Android app:\n\n1. Download 'Expo Go' from the Play Store.\n2. Look at the terminal running on your computer.\n3. Scan the QR code using the Expo Go app.\n4. Log in with your web dashboard account!")}
            >
              How to Install
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Info size={14} />
              Don't want the app? You can continue using manual entry.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
