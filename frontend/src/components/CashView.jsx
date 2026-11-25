import React, { useState } from 'react';
import TransactionForm from './TransactionForm';
import TransactionsTable from './TransactionsTable';

const CashView = ({ refreshAllData, transactions, txLoading, handleDeleteTransaction, getCurrency }) => {
  const [subTab, setSubTab] = useState('add');

  return (
    <div className="main-content cash-view-content">
      <div className="action-cards">
        <div className="cash-tab-toggle-group">
          <button 
            className={`btn cash-tab-btn ${subTab === 'add' ? 'btn-success' : ''}`}
            style={{ flex: 1, background: subTab === 'add' ? 'var(--success)' : 'var(--empty-state-bg)', color: subTab === 'add' ? 'white' : 'var(--text-primary)' }}
            onClick={() => setSubTab('add')}
          >
            Add Money
          </button>
          <button 
            className={`btn cash-tab-btn ${subTab === 'spend' ? 'btn-danger' : ''}`}
            style={{ flex: 1, background: subTab === 'spend' ? 'var(--danger)' : 'var(--empty-state-bg)', color: subTab === 'spend' ? 'white' : 'var(--text-primary)' }}
            onClick={() => setSubTab('spend')}
          >
            Spend Money
          </button>
        </div>
        <TransactionForm
          onTransactionComplete={refreshAllData}
          type={subTab === 'spend' ? 'debit' : 'credit'}
          hideToggle={true}
          fixedWallet="Cash"
        />
      </div>

      <div className="data-cards">
        <TransactionsTable
          title={`Recent Cash ${subTab === 'spend' ? 'Expenses' : 'Income'}`}
          transactions={transactions.filter(tx => tx.wallet === 'Cash' && tx.type === (subTab === 'spend' ? 'debit' : 'credit'))}
          loading={txLoading}
          onDelete={handleDeleteTransaction}
          onEditComplete={refreshAllData}
          hideWallet={true}
          hideRef={true}
        />
      </div>
    </div>
  );
};

export default CashView;
