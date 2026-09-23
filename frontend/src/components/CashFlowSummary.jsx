import React from 'react';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { getCurrency } from '../services/api';

const CashFlowSummary = ({ transactions }) => {
  const totalIncome = transactions
    .filter(t => t.type === 'credit')
    .reduce((acc, curr) => acc + curr.amount, 0);
    
  const totalExpense = transactions
    .filter(t => t.type === 'debit')
    .reduce((acc, curr) => acc + curr.amount, 0);
    
  const netTotal = totalIncome - totalExpense;

  return (
    <div className="dashboard-grid animate-fade-in" style={{ marginTop: '1rem' }}>
      <div className="balance-card glass" style={{ borderLeft: '4px solid var(--success)' }}>
        <div className="card-title">
          <TrendingUp size={20} className="text-success" />
          Period Income
        </div>
        <div className="card-amount text-success">+{getCurrency()}{totalIncome.toLocaleString()}</div>
      </div>
      
      <div className="balance-card glass" style={{ borderLeft: '4px solid var(--danger)' }}>
        <div className="card-title">
          <TrendingDown size={20} className="text-danger" />
          Period Expense
        </div>
        <div className="card-amount text-danger">-{getCurrency()}{totalExpense.toLocaleString()}</div>
      </div>
      
      <div className="balance-card glass" style={{ borderLeft: `4px solid ${netTotal >= 0 ? 'var(--accent-primary)' : 'var(--danger)'}` }}>
        <div className="card-title">
          <Activity size={20} style={{ color: netTotal >= 0 ? 'var(--accent-primary)' : 'var(--danger)' }} />
          Net Cash Flow
        </div>
        <div className="card-amount">{getCurrency()}{netTotal.toLocaleString()}</div>
      </div>
    </div>
  );
};

export default CashFlowSummary;
