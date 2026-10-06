import React from 'react';
import { Wallet, Landmark, Coins } from 'lucide-react';
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
    </div>
  );
};

export default Dashboard;
