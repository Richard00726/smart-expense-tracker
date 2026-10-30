import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ListFilter, Trash2, FileX, Edit2 } from 'lucide-react';
import TransactionForm from './TransactionForm';
import { getCurrency } from '../services/api';

const getCleanPayee = (tx) => {
  if (tx.counterparty) return tx.counterparty;
  if (!tx.note) return tx.wallet === 'Cash' ? 'Cash Transaction' : 'Bank Transaction';
  
  // Format: UPI/000000652067/Indian Railways/SBIN/Pay
  const upiMatch = tx.note.match(/UPI\/\d+\/([^/]+)/i);
  if (upiMatch && upiMatch[1]) return upiMatch[1].trim();
  
  // Format: REIM FOR THE DATE...
  if (/^REIM\s+FOR/i.test(tx.note)) return 'Bank Reimbursement';
  
  return tx.note;
};

const getCategoryStyle = (category) => {
  const cat = (category || '').toLowerCase();
  if (cat === 'salary') {
    return {
      background: 'rgba(16, 185, 129, 0.15)',
      color: '#10b981',
      border: '1px solid rgba(16, 185, 129, 0.35)'
    };
  }
  if (cat === 'atm') {
    return {
      background: 'rgba(245, 158, 11, 0.15)',
      color: '#f59e0b',
      border: '1px solid rgba(245, 158, 11, 0.35)'
    };
  }
  if (cat.includes('jewel')) {
    return {
      background: 'rgba(234, 179, 8, 0.15)',
      color: '#eab308',
      border: '1px solid rgba(234, 179, 8, 0.35)'
    };
  }
  if (cat === 'bank transfer') {
    return {
      background: 'rgba(59, 130, 246, 0.15)',
      color: '#3b82f6',
      border: '1px solid rgba(59, 130, 246, 0.35)'
    };
  }
  if (cat.includes('food')) {
    return {
      background: 'rgba(139, 92, 246, 0.15)',
      color: '#8b5cf6',
      border: '1px solid rgba(139, 92, 246, 0.35)'
    };
  }
  return {
    background: 'rgba(99, 102, 241, 0.1)',
    color: 'var(--accent-secondary, #6366f1)',
    border: '1px solid rgba(99, 102, 241, 0.25)'
  };
};

const getRefNo = (tx) => {
  if (tx.refNo) return tx.refNo;
  if (!tx.note) return null;
  const match = tx.note.match(/UPI\/(\d+)\//i);
  return match ? match[1] : null;
};

const TransactionsTable = ({ 
  transactions, 
  loading, 
  onDelete, 
  onEditComplete, 
  title = "Recent Transactions", 
  badge,
  hideCategory = false, 
  hideActions = false, 
  hideWallet = false,
  hideRef = false,
  filterElement,
  isBankSyncTable = false
}) => {
  const [deletingId, setDeletingId] = useState(null);
  const [editingTx, setEditingTx] = useState(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const sortedTransactions = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    return [...transactions].sort((a, b) => {
      const timeA = new Date(a.date || a.txnDate).getTime();
      const timeB = new Date(b.date || b.txnDate).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdB - createdA;
    });
  }, [transactions]);

  const hasAnyRef = sortedTransactions.some(tx => Boolean(getRefNo(tx)));
  const shouldHideRef = hideRef || !hasAnyRef;
  const isSingleWallet = sortedTransactions.length > 0 && sortedTransactions.every(tx => tx.wallet === sortedTransactions[0]?.wallet);
  const shouldHideWallet = hideWallet || (isSingleWallet && (title.includes('Cash') || title.includes('UPI')));
  const shouldHideCategory = hideCategory;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ListFilter size={20} className="text-accent-primary" /> {title}
          </h3>
          {badge && (
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginLeft: '0.5rem', background: 'var(--card-bg)', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              {badge}
            </span>
          )}
        </div>
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
      ) : isBankSyncTable ? (
        /* Read-Only Bank Statement Table Layout (Official Bank Records) */
        <div className="transaction-table-container">
          <table style={{ tableLayout: 'fixed', width: '100%', minWidth: '700px' }}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Date</th>
                <th>Particulars & Payee</th>
                <th style={{ width: '160px' }}>Category</th>
                <th style={{ width: '140px' }}>Ref / UTR</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Type</th>
                <th style={{ textAlign: 'right', width: '130px', whiteSpace: 'nowrap' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((tx) => (
                <tr key={tx._id || tx.id} className="animate-fade-in">
                  <td style={{ whiteSpace: 'nowrap', fontWeight: '500' }}>
                    {new Date(tx.date || tx.txnDate).toLocaleDateString([], { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric'
                    })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {tx.counterparty || tx.note || 'Bank Transaction'}
                      </span>
                      {tx.note && tx.note !== tx.counterparty && (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.3' }}>
                          {tx.note}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span 
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        ...getCategoryStyle(tx.category)
                      }}
                    >
                      {tx.category || 'Daily Expense'}
                    </span>
                  </td>
                  <td>
                    {tx.refNo ? (
                      <span 
                        style={{ 
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', 
                          fontSize: '12px', 
                          fontWeight: '600',
                          letterSpacing: '0.4px',
                          background: 'var(--empty-state-bg, rgba(99, 102, 241, 0.08))', 
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          border: '1px solid var(--card-border, rgba(148, 163, 184, 0.25))',
                          color: 'var(--text-primary, #0f172a)',
                          display: 'inline-block'
                        }}
                      >
                        {tx.refNo}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '13px' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {tx.type === 'credit' ? (
                      <span 
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          letterSpacing: '0.5px',
                          background: 'rgba(16, 185, 129, 0.14)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        DEPOSIT
                      </span>
                    ) : (
                      <span 
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          letterSpacing: '0.5px',
                          background: 'rgba(239, 68, 68, 0.14)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        WITHDRAWAL
                      </span>
                    )}
                  </td>
                  <td 
                    style={{ 
                      textAlign: 'right', 
                      whiteSpace: 'nowrap', 
                      fontWeight: '700',
                      fontSize: '14.5px',
                      color: tx.type === 'credit' ? '#10b981' : '#ef4444'
                    }}
                  >
                    {tx.type === 'credit' ? '+' : '-'}{getCurrency()}{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Standard Activity & Manual Table Layout */
        <div className="transaction-table-container">
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Date</th>
                {!shouldHideWallet && <th style={{ whiteSpace: 'nowrap' }}>Wallet</th>}
                <th style={{ whiteSpace: 'nowrap' }}>Particulars & Note</th>
                {!shouldHideCategory && <th style={{ whiteSpace: 'nowrap' }}>Category</th>}
                {!shouldHideRef && <th style={{ whiteSpace: 'nowrap' }}>Ref / UTR</th>}
                <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Type</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Amount</th>
                {!hideActions && <th style={{ textAlign: 'center', width: '70px', whiteSpace: 'nowrap' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((tx) => {
                const payee = getCleanPayee(tx);
                const ref = getRefNo(tx);
                const isBankTx = isBankSyncTable || tx.entryMode === 'bank_sync' || Boolean(tx.bank);
                const hasSpecificTime = tx.wallet !== 'Cash' && tx.date && (new Date(tx.date).getHours() !== 0 || new Date(tx.date).getMinutes() !== 0);

                return (
                  <tr key={tx._id || tx.id} className="animate-fade-in">
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                        {new Date(tx.date || tx.txnDate).toLocaleDateString([], { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </div>
                      {hasSpecificTime && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>
                    {!shouldHideWallet && (
                      <td>
                        <span className={`badge ${tx.wallet === 'Cash' ? 'badge-cash' : 'badge-upi'}`}>
                          {tx.wallet}
                        </span>
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {payee}
                        </span>
                        {tx.note && tx.note !== payee && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.3' }}>
                            {tx.note}
                          </span>
                        )}
                      </div>
                    </td>
                    {!shouldHideCategory && (
                      <td>
                        {tx.category ? (
                          <span 
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              ...getCategoryStyle(tx.category)
                            }}
                          >
                            {tx.category}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    )}
                    {!shouldHideRef && (
                      <td>
                        {ref ? (
                          <span 
                            style={{ 
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', 
                              fontSize: '11.5px', 
                              fontWeight: '600',
                              letterSpacing: '0.4px',
                              background: 'var(--empty-state-bg, rgba(99, 102, 241, 0.08))', 
                              padding: '2px 7px', 
                              borderRadius: '6px', 
                              border: '1px solid var(--card-border, rgba(148, 163, 184, 0.25))',
                              color: 'var(--text-primary, #0f172a)',
                              display: 'inline-block'
                            }}
                          >
                            {ref}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    )}
                    <td style={{ textAlign: 'center' }}>
                      {tx.type === 'credit' ? (
                        <span 
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '0.5px',
                            background: 'rgba(16, 185, 129, 0.14)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          {isBankTx ? 'DEPOSIT' : 'CREDIT'}
                        </span>
                      ) : (
                        <span 
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '0.5px',
                            background: 'rgba(239, 68, 68, 0.14)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          {isBankTx ? 'WITHDRAWAL' : 'DEBIT'}
                        </span>
                      )}
                    </td>
                    <td 
                      style={{ 
                        textAlign: 'right', 
                        whiteSpace: 'nowrap', 
                        fontWeight: '700',
                        fontSize: '14.5px',
                        color: tx.type === 'credit' ? '#10b981' : '#ef4444'
                      }}
                    >
                      {tx.type === 'credit' ? '+' : '-'}{getCurrency()}{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                            onClick={() => requestDelete(tx._id || tx.id)}
                            disabled={deletingId === (tx._id || tx.id)}
                            className="action-btn delete-btn"
                            title="Delete transaction"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
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
