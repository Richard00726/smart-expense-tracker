import React from 'react';
import { Wallet, Landmark, Coins, Smartphone, Zap } from 'lucide-react';
import { getCurrency } from '../services/api';

const Dashboard = ({ balances, onOpenSetupGuide }) => {
  return (
    <div className="dashboard-grid animate-fade-in">
      <div className="balance-card glass">
        <div className="card-title">
          <Landmark size={20} className="text-accent-primary" />
          Total Balance
        </div>
        <div className="card-amount">{getCurrency()}{balances.total.toLocaleString()}</div>
        <div className="upi-card-footer">
          <span className="footer-tag">Combined Cash & Bank Balance</span>
        </div>
      </div>
      
      <div className="balance-card cash glass">
        <div className="card-title">
          <Coins size={20} className="text-success" />
          Cash Balance
        </div>
        <div className="card-amount">{getCurrency()}{balances.cash.toLocaleString()}</div>
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
          <div 
            className="upi-live-pill" 
            onClick={onOpenSetupGuide}
            title="Auto-tracking active on Android phone. Click to view Mobile Guide."
          >
            <span className="pulse-dot-green"></span>
            <span>Live Auto-Sync</span>
          </div>
        </div>
        <div className="card-amount">{getCurrency()}{balances.upi.toLocaleString()}</div>
        <div className="upi-card-footer">
          <span className="footer-tag" style={{ color: '#10b981', fontWeight: 500 }}>
            <Zap size={12} color="#10b981" /> Auto-syncs bank SMS & UPI
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
