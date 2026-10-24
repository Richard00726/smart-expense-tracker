import React, { useState } from 'react';
import TransactionForm from './TransactionForm';
import TransactionsTable from './TransactionsTable';

const CashView = ({ refreshAllData, transactions, txLoading, handleDeleteTransaction, getCurrency }) => {
  const [subTab, setSubTab] = useState('add');

  return (
    <div className="main-content" style={{ marginTop: '2rem' }}>
      <div className="action-cards">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'center', width: '100%' }}>
          <button 
            className={`btn ${subTab === 'add' ? 'btn-success' : ''}`}
            style={{ flex: 1, background: subTab === 'add' ? 'var(--success)' : 'var(--empty-state-bg)', color: subTab === 'add' ? 'white' : 'var(--text-primary)', padding: '0.5rem' }}
            onClick={() => setSubTab('add')}
          >
            Add Money
          </button>
          <button 
            className={`btn ${subTab === 'spend' ? 'btn-danger' : ''}`}
            style={{ flex: 1, background: subTab === 'spend' ? 'var(--danger)' : 'var(--empty-state-bg)', color: subTab === 'spend' ? 'white' : 'var(--text-primary)', padding: '0.5rem' }}
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
