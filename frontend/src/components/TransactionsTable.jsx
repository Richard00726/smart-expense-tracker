import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ListFilter, Trash2, FileX, Edit2 } from 'lucide-react';
import TransactionForm from './TransactionForm';
import { getCurrency } from '../services/api';

const TransactionsTable = ({ transactions, loading, onDelete, onEditComplete, title = "Recent Transactions", hideCategory = false, hideActions = false, filterElement }) => {
  const [deletingId, setDeletingId] = useState(null);
  const [editingTx, setEditingTx] = useState(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const requestDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (confirmDeleteId) {
      setDeletingId(confirmDeleteId);
      await onDelete(confirmDeleteId);
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
  };

  if (loading) {
    return (
      <div className="data-card glass">
        <div className="empty-state">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="data-card glass">
      <div className="data-header">
        <h3><ListFilter size={20} className="text-accent-primary" /> {title}</h3>
        {filterElement && <div className="filter-wrapper">{filterElement}</div>}
      </div>
      
      {transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon-wrapper">
            <FileX size={48} className="empty-state-icon" />
          </div>
          <h3>No Transactions Found</h3>
          <p>Add some money or record an expense to get started.</p>
        </div>
      ) : (
        <div className="transaction-table-container">
          <table style={{ tableLayout: 'fixed', width: '100%', minWidth: '600px' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Wallet</th>
                {!hideCategory && <th>Category</th>}
                <th>Note</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Amount</th>
                {!hideActions && <th style={{ textAlign: 'center', width: '60px' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx._id} className="animate-fade-in">
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(tx.date).toLocaleDateString([], { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric'
                    })}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {new Date(tx.date).toLocaleTimeString([], { 
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>
                    <span className={`badge ${tx.wallet === 'Cash' ? 'badge-cash' : 'badge-upi'}`}>
                      {tx.wallet}
                    </span>
                  </td>
                  {!hideCategory && <td>{tx.category || (tx.type === 'credit' ? 'Credited' : '-')}</td>}
                  <td style={{ color: 'var(--text-secondary)' }}>{tx.note || '-'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className={tx.type === 'credit' ? 'amount-credit' : 'amount-debit'}>
                    {tx.type === 'credit' ? '+' : '-'}{getCurrency()}{tx.amount.toLocaleString()}
                  </td>
                  {!hideActions && (
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        <button 
                          onClick={() => setEditingTx(tx)}
                          className="action-btn edit-btn"
                          title="Edit transaction"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => requestDelete(tx._id)}
                          disabled={deletingId === tx._id}
                          className="action-btn delete-btn"
                          title="Delete transaction"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDeleteId && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass animate-fade-in">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: '600' }}>
              Undo Transaction?
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
              No worries! Deleting this will safely reverse the amount back to your wallet balance.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                style={{ background: 'var(--empty-state-bg)', color: 'var(--text-primary)' }} 
                onClick={cancelDelete}
              >
                Keep it
              </button>
              <button 
                className="btn btn-danger" 
                onClick={confirmDelete}
              >
                Yes, Undo it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {editingTx && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass animate-fade-in" style={{ padding: 0, maxWidth: '500px', width: '100%' }}>
            <TransactionForm 
              editData={editingTx}
              type={editingTx.type}
              hideToggle={true}
              onCancel={() => setEditingTx(null)}
              onTransactionComplete={() => {
                setEditingTx(null);
                if (onEditComplete) onEditComplete();
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TransactionsTable;
