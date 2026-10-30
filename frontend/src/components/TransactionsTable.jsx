import React, { useState, useMemo, useRef } from 'react';
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

  // Format: MBank/627806381285/Tr To SELVI T/Rent or MBank/629812953800/Self/by LOURDURAJ M
  const mbankMatch = tx.note.match(/MBank\/\d+\/(?:Tr To\s+|To\s+|Self\/by\s+|by\s+)?([^/]+)/i);
  if (mbankMatch && mbankMatch[1]) {
    const rawTarget = mbankMatch[1].trim();
    if (rawTarget.toLowerCase().startsWith('self')) return 'Self Transfer';
    if (rawTarget.length > 2) return `Transfer to ${rawTarget}`;
    return 'Bank Transfer';
  }

  // Format: ATM/CASH/571563/629813571563
  if (/^ATM\/CASH/i.test(tx.note)) return 'ATM Cash Withdrawal';

  // Format: Cr Crd bill SEP2026...
  if (/^Cr\s*Crd\s*bill/i.test(tx.note)) return 'Credit Card Bill Payment';
  
  // Format: REIM FOR THE DATE...
  if (/^REIM\s+FOR/i.test(tx.note)) return 'Bank Reimbursement';
  
  return tx.note;
};

const getCategoryStyle = (category) => {
  const cat = (category || '').toLowerCase();
  if (cat === 'salary' || cat === 'income') {
    return {
      background: 'var(--success-bg)',
      color: 'var(--success)',
      border: '1px solid var(--success-border)'
    };
  }
  if (cat === 'atm') {
    return {
      background: 'rgba(245, 158, 11, 0.12)',
      color: '#f59e0b',
      border: '1px solid rgba(245, 158, 11, 0.25)'
    };
  }
  if (cat.includes('jewel') || cat.includes('gold')) {
    return {
      background: 'rgba(202, 138, 4, 0.12)',
      color: '#ca8a04',
      border: '1px solid rgba(202, 138, 4, 0.25)'
    };
  }
  if (cat.includes('credit card') || cat.includes('crd bill') || cat.includes('cc bill')) {
    return {
      background: 'rgba(13, 148, 136, 0.12)',
      color: '#0d9488',
      border: '1px solid rgba(13, 148, 136, 0.25)'
    };
  }
  if (cat.includes('rent') || cat.includes('housing') || cat.includes('society')) {
    return {
      background: 'rgba(99, 102, 241, 0.12)',
      color: '#6366f1',
      border: '1px solid rgba(99, 102, 241, 0.25)'
    };
  }
  if (cat.includes('invest') || cat.includes('sip') || cat.includes('mutual fund')) {
    return {
      background: 'rgba(5, 150, 105, 0.12)',
      color: '#059669',
      border: '1px solid rgba(5, 150, 105, 0.25)'
    };
  }
  if (cat.includes('subscri') || cat.includes('ott') || cat.includes('netflix') || cat.includes('prime')) {
    return {
      background: 'rgba(139, 92, 246, 0.12)',
      color: '#8b5cf6',
      border: '1px solid rgba(139, 92, 246, 0.25)'
    };
  }
  if (cat.includes('fuel') || cat.includes('petrol') || cat.includes('vehicle') || cat.includes('diesel')) {
    return {
      background: 'rgba(37, 99, 235, 0.12)',
      color: '#2563eb',
      border: '1px solid rgba(37, 99, 235, 0.25)'
    };
  }
  if (cat.includes('educat') || cat.includes('learn') || cat.includes('course') || cat.includes('fee')) {
    return {
      background: 'rgba(2, 132, 199, 0.12)',
      color: '#0284c7',
      border: '1px solid rgba(2, 132, 199, 0.25)'
    };
  }
  if (cat.includes('personal') || cat.includes('care') || cat.includes('fitness') || cat.includes('gym') || cat.includes('salon')) {
    return {
      background: 'rgba(249, 115, 22, 0.12)',
      color: '#f97316',
      border: '1px solid rgba(249, 115, 22, 0.25)'
    };
  }
  if (cat.includes('gift') || cat.includes('donat') || cat.includes('charity')) {
    return {
      background: 'rgba(244, 63, 94, 0.12)',
      color: '#f43f5e',
      border: '1px solid rgba(244, 63, 94, 0.25)'
    };
  }
  if (cat === 'travel' || cat.includes('rail') || cat.includes('flight') || cat.includes('irctc')) {
    return {
      background: 'rgba(124, 58, 237, 0.12)',
      color: '#7c3aed',
      border: '1px solid rgba(124, 58, 237, 0.25)'
    };
  }
  if (cat.includes('bill') || cat.includes('recharge')) {
    return {
      background: 'rgba(8, 145, 178, 0.12)',
      color: '#0891b2',
      border: '1px solid rgba(8, 145, 178, 0.25)'
    };
  }
  if (cat.includes('food') || cat.includes('grocer')) {
    return {
      background: 'rgba(234, 88, 12, 0.12)',
      color: '#ea580c',
      border: '1px solid rgba(234, 88, 12, 0.25)'
    };
  }
  if (cat.includes('shop') || cat.includes('order')) {
    return {
      background: 'rgba(219, 39, 119, 0.12)',
      color: '#db2777',
      border: '1px solid rgba(219, 39, 119, 0.25)'
    };
  }
  if (cat.includes('entertain')) {
    return {
      background: 'rgba(162, 28, 175, 0.12)',
      color: '#a21caf',
      border: '1px solid rgba(162, 28, 175, 0.25)'
    };
  }
  if (cat.includes('health') || cat.includes('medic')) {
    return {
      background: 'rgba(220, 38, 38, 0.12)',
      color: '#dc2626',
      border: '1px solid rgba(220, 38, 38, 0.25)'
    };
  }
  if (cat.includes('reim')) {
    return {
      background: 'rgba(14, 116, 144, 0.12)',
      color: '#0e7490',
      border: '1px solid rgba(14, 116, 144, 0.25)'
    };
  }
  if (cat === 'bank transfer' || cat.includes('upi')) {
    return {
      background: 'var(--badge-bg)',
      color: 'var(--badge-text)',
      border: '1px solid var(--badge-border)'
    };
  }
  return {
    background: 'var(--badge-bg)',
    color: 'var(--badge-text)',
    border: '1px solid var(--badge-border)'
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
  const isDeletingRef = useRef(false);

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
    if (isDeletingRef.current) return;
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (confirmDeleteId && !isDeletingRef.current) {
      isDeletingRef.current = true;
      const idToDelete = confirmDeleteId;
      setDeletingId(idToDelete);
      try {
        await onDelete(idToDelete);
      } finally {
        isDeletingRef.current = false;
        setDeletingId(null);
        setConfirmDeleteId(null);
      }
    }
  };

  const cancelDelete = () => {
    if (isDeletingRef.current) return;
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
    <div className="activity-card data-card">
      <div className="activity-header data-header">
        <div className="activity-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div className="activity-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ListFilter size={18} strokeWidth={2} />
            <span>{title}</span>
          </div>
          {badge && (
            <span className="activity-badge">
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
        <div className="table-container transaction-table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '140px', minWidth: '125px', whiteSpace: 'nowrap' }}>Date</th>
                <th>Particulars & Payee</th>
                <th style={{ width: '170px', minWidth: '155px', whiteSpace: 'nowrap' }}>Category</th>
                <th style={{ width: '150px', minWidth: '130px', whiteSpace: 'nowrap' }}>Ref / UTR</th>
                <th style={{ width: '130px', minWidth: '110px', textAlign: 'center', whiteSpace: 'nowrap' }}>Type</th>
                <th style={{ width: '150px', minWidth: '130px', textAlign: 'right', whiteSpace: 'nowrap' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((tx) => (
                <tr key={tx._id || tx.id} className="animate-fade-in">
                  <td style={{ whiteSpace: 'nowrap', fontWeight: '600' }}>
                    {new Date(tx.date || tx.txnDate).toLocaleDateString([], { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric'
                    })}
                  </td>
                  <td>
                    <span className="payee-title">
                      {tx.counterparty || tx.note || 'Bank Transaction'}
                    </span>
                    {tx.note && tx.note !== tx.counterparty && (
                      <span className="payee-subtitle">
                        {tx.note}
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="badge-category" style={getCategoryStyle(tx.category)}>
                      {tx.category || 'Daily Expense'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {tx.refNo ? (
                      <span className="ref-code">
                        {tx.refNo}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {tx.type === 'credit' ? (
                      <span className="type-pill type-deposit">DEPOSIT</span>
                    ) : (
                      <span className="type-pill type-withdrawal">WITHDRAWAL</span>
                    )}
                  </td>
                  <td 
                    className={`amount-val ${tx.type === 'credit' ? 'amount-pos' : 'amount-neg'}`}
                    style={{ whiteSpace: 'nowrap', textAlign: 'right', minWidth: '130px' }}
                  >
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                      {tx.type === 'credit' ? '+' : '-'}{getCurrency()}{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Standard Activity & Manual Table Layout */
        <div className="table-container transaction-table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '140px', minWidth: '125px', whiteSpace: 'nowrap' }}>Date</th>
                {!shouldHideWallet && <th style={{ width: '110px', minWidth: '90px', whiteSpace: 'nowrap' }}>Wallet</th>}
                <th>Particulars & Payee</th>
                {!shouldHideCategory && <th style={{ width: '170px', minWidth: '155px', whiteSpace: 'nowrap' }}>Category</th>}
                {!shouldHideRef && <th style={{ width: '150px', minWidth: '130px', whiteSpace: 'nowrap' }}>Ref / UTR</th>}
                <th style={{ width: '130px', minWidth: '110px', textAlign: 'center', whiteSpace: 'nowrap' }}>Type</th>
                <th style={{ width: '150px', minWidth: '130px', textAlign: 'right', whiteSpace: 'nowrap' }}>Amount</th>
                {!hideActions && <th style={{ textAlign: 'center', width: '80px', minWidth: '80px', whiteSpace: 'nowrap' }}>Action</th>}
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
                    <td style={{ whiteSpace: 'nowrap', fontWeight: '600' }}>
                      <div>
                        {new Date(tx.date || tx.txnDate).toLocaleDateString([], { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </div>
                      {hasSpecificTime && (
                        <div className="payee-subtitle" style={{ marginTop: '2px' }}>
                          {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>
                    {!shouldHideWallet && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className={`badge ${tx.wallet === 'Cash' ? 'badge-cash' : 'badge-upi'}`}>
                          {tx.wallet}
                        </span>
                      </td>
                    )}
                    <td>
                      <span className="payee-title">
                        {payee}
                      </span>
                      {tx.note && tx.note !== payee && (
                        <span className="payee-subtitle">
                          {tx.note}
                        </span>
                      )}
                    </td>
                    {!shouldHideCategory && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {tx.category ? (
                          <span className="badge-category" style={getCategoryStyle(tx.category)}>
                            {tx.category}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    )}
                    {!shouldHideRef && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {ref ? (
                          <span className="ref-code">
                            {ref}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    )}
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {tx.type === 'credit' ? (
                        <span className="type-pill type-deposit">
                          {isBankTx ? 'DEPOSIT' : 'CREDIT'}
                        </span>
                      ) : (
                        <span className="type-pill type-withdrawal">
                          {isBankTx ? 'WITHDRAWAL' : 'DEBIT'}
                        </span>
                      )}
                    </td>
                    <td 
                      className={`amount-val ${tx.type === 'credit' ? 'amount-pos' : 'amount-neg'}`}
                      style={{ whiteSpace: 'nowrap', textAlign: 'right', minWidth: '130px' }}
                    >
                      <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                        {tx.type === 'credit' ? '+' : '-'}{getCurrency()}{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
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
                disabled={Boolean(deletingId)}
              >
                Keep it
              </button>
              <button 
                className="btn btn-danger" 
                onClick={confirmDelete}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? 'Undoing...' : 'Yes, Undo it'}
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
