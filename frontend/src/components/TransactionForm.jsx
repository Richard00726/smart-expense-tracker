import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PlusCircle, MinusCircle, PartyPopper, AlertCircle, Edit2 } from 'lucide-react';
import { createTransaction, updateTransaction, getCurrency } from '../services/api';

const TransactionForm = ({ onTransactionComplete, type, onTypeChange, hideToggle, editData, onCancel }) => {
  const [wallet, setWallet] = useState('Cash');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const categories = [
    'Food', 'Travel', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Trading', 'Other'
  ];

  useEffect(() => {
    if (editData) {
      setWallet(editData.wallet || 'Cash');
      setAmount(editData.amount || '');
      
      if (editData.category) {
        if (categories.includes(editData.category)) {
          setCategory(editData.category);
          setCustomCategory('');
        } else {
          setCategory('Other');
          setCustomCategory(editData.category);
        }
      } else {
        setCategory('');
        setCustomCategory('');
      }

      setNote(editData.note || '');
      if (editData.date) {
        // Format to YYYY-MM-DDTHH:mm for datetime-local
        const d = new Date(editData.date);
        const pad = (n) => n.toString().padStart(2, '0');
        const formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setDate(formattedDate);
      }
    }
  }, [editData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (type === 'debit') {
      if (!category) {
        setError('Please select a category');
        return;
      }
      if (category === 'Other' && !customCategory.trim()) {
        setError('Please enter a custom category');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const finalCategory = type === 'debit' ? (category === 'Other' ? customCategory.trim() : category) : undefined;

      const payload = {
        wallet,
        type,
        amount: Number(amount),
        category: finalCategory,
        note,
        date: date ? new Date(date).toISOString() : undefined
      };

      if (editData) {
        await updateTransaction(editData._id, payload);
      } else {
        await createTransaction(payload);
      }

      // Reset form if not editing
      if (!editData) {
        setAmount('');
        setNote('');
        setDate('');
        if (type === 'debit') {
          setCategory('');
          setCustomCategory('');
        }
      }

      // Notify parent to refresh data
      if (onTransactionComplete) {
        onTransactionComplete();
      }

      // Show toast
      setToast({
        message: editData ? 'Transaction updated! ✨' : (type === 'credit' ? 'Awesome! Money in! 🎉' : 'Expense recorded! 💸'),
        type: editData ? 'success' : (type === 'credit' ? 'success' : 'expense')
      });
      setTimeout(() => setToast(null), 3500);

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-card glass animate-fade-in">
      <h3>
        {editData ? (
          <><Edit2 size={24} className="text-accent-primary" /> Edit Transaction</>
        ) : type === 'debit' ? (
          <><MinusCircle size={24} className="text-danger" /> Spend Money</>
        ) : (
          <><PlusCircle size={24} className="text-success" /> Add Money</>
        )}
      </h3>

      {!hideToggle && !editData && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            className={`btn ${type === 'debit' ? 'btn-danger' : ''}`}
            style={{ flex: 1, background: type === 'debit' ? 'var(--danger)' : 'var(--empty-state-bg)', color: type === 'debit' ? 'white' : 'var(--text-primary)' }}
            onClick={() => onTypeChange('debit')}
          >
            Spend
          </button>
          <button
            type="button"
            className={`btn ${type === 'credit' ? 'btn-success' : ''}`}
            style={{ flex: 1, background: type === 'credit' ? 'var(--success)' : 'var(--empty-state-bg)', color: type === 'credit' ? 'white' : 'var(--text-primary)' }}
            onClick={() => onTypeChange('credit')}
          >
            Add
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Wallet</label>
          <select
            className="form-control"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            disabled={editData && editData.wallet === 'UPI'}
          >
            {(editData && editData.wallet === 'UPI') && <option value="UPI">UPI</option>}
            <option value="Cash">Cash</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Amount ({getCurrency()})</label>
          <input
            type="number"
            className="form-control"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {type === 'debit' && (
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-control"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {category === 'Other' && (
              <input
                type="text"
                className="form-control"
                placeholder="Enter custom category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                style={{ marginTop: '0.75rem' }}
                autoFocus
              />
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Note (Optional)</label>
          <input
            type="text"
            className="form-control"
            placeholder="What was this for?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Date & Time (Optional)</label>
          <input
            type="datetime-local"
            className="form-control"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
            Leave blank to use current date & time
          </small>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          {editData && (
            <button
              type="button"
              className="btn"
              style={{ flex: 1, background: 'var(--empty-state-bg)', color: 'var(--text-primary)' }}
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ flex: editData ? 1 : 'unset', width: editData ? 'auto' : '100%' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : editData ? 'Save Changes' : (type === 'debit' ? 'Record Expense' : 'Add Balance')}
          </button>
        </div>
      </form>

      {toast && createPortal(
        <>
          <div className={`toast-overlay ${toast.type}`}></div>
          <div className={`toast-notification ${toast.type}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <PartyPopper size={20} />}
            <span style={{ whiteSpace: 'nowrap' }}>{toast.message}</span>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default TransactionForm;
