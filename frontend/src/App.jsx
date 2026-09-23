import React, { useState, useEffect } from 'react';
import { getWallets, getTransactions, getSummary, deleteTransaction } from './services/api';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import TransactionsTable from './components/TransactionsTable';
import AnalysisView from './components/AnalysisView';
import AuthScreen from './components/AuthScreen';
import AccountView from './components/AccountView';
import BudgetView from './components/BudgetView';
import { Wallet as WalletIcon, Home, PieChart, ArrowUpRight, ArrowDownRight, Activity, Sun, Moon, LogOut, User, Target } from 'lucide-react';
import './index.css';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [showProfileTooltip, setShowProfileTooltip] = useState(false);
  const [balances, setBalances] = useState({ cash: 0, upi: 0, total: 0 });
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const currentMonthString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentYearString = today.getFullYear().toString();

  const [txFilterType, setTxFilterType] = useState('month');
  const [txFilterValue, setTxFilterValue] = useState(currentMonthString);
  const [txWalletFilter, setTxWalletFilter] = useState('all');

  const handleTxFilterTypeChange = (newType) => {
    setTxFilterType(newType);
    if (newType === 'day') setTxFilterValue(todayString);
    else if (newType === 'month') setTxFilterValue(currentMonthString);
    else if (newType === 'year') setTxFilterValue(currentYearString);
    else setTxFilterValue('');
  };

  const getDashboardFeedTitle = () => {
    if (txFilterType === 'month') return 'Recent Activity (This Month)';
    if (txFilterType === 'today') return 'Recent Activity (Today)';
    if (txFilterType === 'all') return 'Recent Activity (All Time)';
    return 'Recent Activity';
  };
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const loadWallets = async () => {
    try {
      const res = await getWallets();
      setBalances(res.data);
    } catch (error) {
      console.error("Failed to load wallets:", error);
    }
  };



  const loadTransactions = async () => {
    try {
      setTxLoading(true);
      let txFilters = {};
      const now = new Date();

      if (txFilterType === 'all') {
        txFilters = {}; // No date filters
      } else if (txFilterType === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        txFilters = { startDate: start.toISOString(), endDate: end.toISOString() };
      } else if (txFilterValue) {
        if (txFilterType === 'day') {
          const start = new Date(txFilterValue);
          start.setHours(0, 0, 0, 0);
          const end = new Date(txFilterValue);
          end.setHours(23, 59, 59, 999);
          txFilters = { startDate: start.toISOString(), endDate: end.toISOString() };
        } else if (txFilterType === 'month') {
          const [year, month] = txFilterValue.split('-');
          const start = new Date(year, month - 1, 1);
          const end = new Date(year, month, 0, 23, 59, 59, 999);
          txFilters = { startDate: start.toISOString(), endDate: end.toISOString() };
        } else if (txFilterType === 'year') {
          const start = new Date(txFilterValue, 0, 1);
          const end = new Date(txFilterValue, 11, 31, 23, 59, 59, 999);
          txFilters = { startDate: start.toISOString(), endDate: end.toISOString() };
        }
      }

      if (txWalletFilter !== 'all') {
        txFilters.wallet = txWalletFilter;
      }

      const res = await getTransactions(txFilters);
      setTransactions(res.data);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setTxLoading(false);
    }
  };

  const refreshAllData = () => {
    loadWallets();
    loadTransactions();
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await deleteTransaction(id);
      refreshAllData();
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      alert("Failed to delete transaction. Please try again.");
    }
  };

  useEffect(() => {
    const handleAuthError = () => setIsAuthenticated(false);
    const handleUserUpdate = () => setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}'));
    
    window.addEventListener('auth_error', handleAuthError);
    window.addEventListener('user_updated', handleUserUpdate);
    
    return () => {
      window.removeEventListener('auth_error', handleAuthError);
      window.removeEventListener('user_updated', handleUserUpdate);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentUser({});
  };

  useEffect(() => {
    if (isAuthenticated) loadWallets();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadTransactions();
  }, [txFilterType, txFilterValue, txWalletFilter, isAuthenticated]);

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className={`app-layout ${activeTab === 'spend' ? 'bg-blush-spend' : ''} ${activeTab === 'add' ? 'bg-blush-add' : ''}`}>
      {/* Sidebar (Desktop) */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <WalletIcon size={28} />
          Smart Expense Tracker
        </div>
        <div 
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <Home size={20} />
          <span>Dashboard</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'spend' ? 'active' : ''}`}
          onClick={() => setActiveTab('spend')}
        >
          <ArrowUpRight size={20} />
          <span>Spend Money</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <ArrowDownRight size={20} />
          <span>Add Money</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'budget' ? 'active' : ''}`}
          onClick={() => setActiveTab('budget')}
        >
          <Target size={20} />
          <span>Budget & Savings</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <PieChart size={20} />
          <span>Analysis</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          <User size={20} />
          <span>My Account</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-container">
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="header-title">
            {activeTab === 'home' && 'Dashboard'}
            {activeTab === 'spend' && 'Spend Money'}
            {activeTab === 'add' && 'Add Money'}
            {activeTab === 'budget' && 'Budget & Savings'}
            {activeTab === 'analysis' && 'Analysis & Insights'}
            {activeTab === 'account' && 'My Account'}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={toggleTheme}
              className="action-btn"
              style={{ background: 'var(--card-bg)', padding: '0.6rem', borderRadius: '50%', color: 'var(--text-primary)' }}
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div 
              style={{ position: 'relative', display: 'flex', alignItems: 'center', margin: '0 0.25rem' }}
              onMouseEnter={() => setShowProfileTooltip(true)}
              onMouseLeave={() => setShowProfileTooltip(false)}
            >
              <div 
                style={{ 
                  width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', 
                  border: '2px solid var(--card-border)', background: 'var(--empty-state-bg)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                }}
              >
                {currentUser.profileImage ? (
                  <img src={currentUser.profileImage} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={20} color="var(--text-secondary)" />
                )}
              </div>
              {showProfileTooltip && (
                <div className="glass animate-fade-in" style={{
                  position: 'absolute', top: '120%', right: '50%', transform: 'translateX(50%)',
                  padding: '0.75rem 1rem', borderRadius: '8px', zIndex: 1000,
                  whiteSpace: 'nowrap', textAlign: 'center', border: '1px solid var(--card-border)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}>
                  <p style={{ margin: '0 0 0.25rem 0', fontWeight: '600', color: 'var(--text-primary)' }}>{currentUser.username}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{currentUser.email}</p>
                </div>
              )}
            </div>

            <button 
              onClick={handleLogout}
              className="action-btn"
              style={{ background: 'var(--danger)', padding: '0.6rem', borderRadius: '50%', color: '#fff' }}
              title="Log out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main>
          {activeTab === 'home' && (
            <>
              <Dashboard balances={balances} />

              <div className="main-content" style={{ marginTop: '2rem' }}>
                <div className="action-cards" style={{ gridColumn: '1 / -1' }}>
                  <TransactionsTable
                    title={getDashboardFeedTitle()}
                    transactions={transactions.slice(0, 5)}
                    loading={txLoading}
                    onDelete={handleDeleteTransaction}
                    onEditComplete={refreshAllData}
                    hideCategory={false}
                    hideActions={true}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'spend' && (
            <div className="main-content" style={{ marginTop: '2rem' }}>
              <div className="action-cards">
                <TransactionForm
                  onTransactionComplete={refreshAllData}
                  type="debit"
                  hideToggle={true}
                />
              </div>

              <div className="data-cards">
                <TransactionsTable
                  title="Recent Expenses"
                  transactions={transactions.filter(tx => tx.type === 'debit')}
                  loading={txLoading}
                  onDelete={handleDeleteTransaction}
                  onEditComplete={refreshAllData}
                  filterElement={
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {txFilterType === 'day' && (
                        <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={txFilterValue} onChange={e => setTxFilterValue(e.target.value)} />
                      )}
                      {txFilterType === 'month' && (
                        <input type="month" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={txFilterValue} onChange={e => setTxFilterValue(e.target.value)} />
                      )}
                      {txFilterType === 'year' && (
                        <input type="number" min="2000" max="2100" placeholder="YYYY" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={txFilterValue} onChange={e => setTxFilterValue(e.target.value)} />
                      )}
                      <select
                        className="form-control"
                        style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        value={txWalletFilter}
                        onChange={(e) => setTxWalletFilter(e.target.value)}
                      >
                        <option value="all">All</option>
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                      </select>
                      <select
                        className="form-control"
                        style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        value={txFilterType}
                        onChange={(e) => handleTxFilterTypeChange(e.target.value)}
                      >
                        <option value="today">Today</option>
                        <option value="day">By Day</option>
                        <option value="month">By Month</option>
                        <option value="year">By Year</option>
                        <option value="all">All Time</option>
                      </select>
                    </div>
                  }
                />
              </div>
            </div>
          )}

          {activeTab === 'add' && (
            <div className="main-content" style={{ marginTop: '2rem' }}>
              <div className="action-cards">
                <TransactionForm
                  onTransactionComplete={refreshAllData}
                  type="credit"
                  hideToggle={true}
                />
              </div>

              <div className="data-cards">
                <TransactionsTable
                  title="Recent Income"
                  transactions={transactions.filter(tx => tx.type === 'credit')}
                  loading={txLoading}
                  onDelete={handleDeleteTransaction}
                  onEditComplete={refreshAllData}
                  hideCategory={true}
                  filterElement={
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {txFilterType === 'day' && (
                        <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={txFilterValue} onChange={e => setTxFilterValue(e.target.value)} />
                      )}
                      {txFilterType === 'month' && (
                        <input type="month" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={txFilterValue} onChange={e => setTxFilterValue(e.target.value)} />
                      )}
                      {txFilterType === 'year' && (
                        <input type="number" min="2000" max="2100" placeholder="YYYY" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={txFilterValue} onChange={e => setTxFilterValue(e.target.value)} />
                      )}
                      <select
                        className="form-control"
                        style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        value={txWalletFilter}
                        onChange={(e) => setTxWalletFilter(e.target.value)}
                      >
                        <option value="all">All</option>
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                      </select>
                      <select
                        className="form-control"
                        style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        value={txFilterType}
                        onChange={(e) => handleTxFilterTypeChange(e.target.value)}
                      >
                        <option value="today">Today</option>
                        <option value="day">By Day</option>
                        <option value="month">By Month</option>
                        <option value="year">By Year</option>
                        <option value="all">All Time</option>
                      </select>
                    </div>
                  }
                />
              </div>
            </div>
          )}

          {activeTab === 'budget' && (
            <div style={{ marginTop: '2rem' }}>
              <BudgetView transactions={transactions} />
            </div>
          )}

          {activeTab === 'analysis' && (
            <div style={{ marginTop: '0.5rem', marginBottom: '2rem' }}>
              <AnalysisView refreshTrigger={transactions} />
            </div>
          )}

          {activeTab === 'account' && (
            <div style={{ marginTop: '2rem' }}>
              <AccountView theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} />
            </div>
          )}

        </main>
      </div>

      {/* Bottom Navigation (Mobile) */}
      <nav className="bottom-nav">
        <div 
          className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <Home size={22} />
          <span>Home</span>
        </div>
        <div 
          className={`bottom-nav-item ${activeTab === 'spend' ? 'active' : ''}`}
          onClick={() => setActiveTab('spend')}
        >
          <ArrowUpRight size={22} />
          <span>Spend</span>
        </div>
        <div 
          className={`bottom-nav-item ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <ArrowDownRight size={22} />
          <span>Add</span>
        </div>
        <div 
          className={`bottom-nav-item ${activeTab === 'budget' ? 'active' : ''}`}
          onClick={() => setActiveTab('budget')}
        >
          <Target size={22} />
          <span>Budget</span>
        </div>
        <div 
          className={`bottom-nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <PieChart size={22} />
          <span>Analysis</span>
        </div>
        <div 
          className={`bottom-nav-item ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          <User size={22} />
          <span>Account</span>
        </div>
      </nav>
    </div>
  );
}

export default App;
