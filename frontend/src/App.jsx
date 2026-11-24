import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getWallets, getTransactions, getSummary, deleteTransaction, getCurrency, getBankSyncSettings, syncGmailNow } from './services/api';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import TransactionsTable from './components/TransactionsTable';
import AnalysisView from './components/AnalysisView';
import CashView from './components/CashView';
import UpiView from './components/UpiView';
import AuthScreen from './components/AuthScreen';
import AccountView from './components/AccountView';
import BudgetView from './components/BudgetView';
import ErrorBoundary from './components/ErrorBoundary';
import PrivacyPolicy from './components/PrivacyPolicy';
import SystemStatusOverlay from './components/SystemStatusOverlay';
import IntroSplash from './components/IntroSplash';
import { Wallet as WalletIcon, Home, PieChart, Activity, Sun, Moon, LogOut, User, Target, Smartphone, Coins, CreditCard } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import './index.css';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return sessionStorage.getItem('skip_splash') !== 'true';
    } catch {
      return true;
    }
  });
  const [hasSessionSplashShown, setHasSessionSplashShown] = useState(() => {
    try {
      return sessionStorage.getItem('skip_splash') === 'true';
    } catch {
      return false;
    }
  });
  const [showProfileTooltip, setShowProfileTooltip] = useState(false);
  const [balances, setBalances] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_balances');
      return cached ? JSON.parse(cached) : { cash: 0, upi: 0, total: 0 };
    } catch {
      return { cash: 0, upi: 0, total: 0 };
    }
  });
  const [transactions, setTransactions] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_transactions');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [txLoading, setTxLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_transactions');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });
  const [activeTab, setActiveTab] = useState(() => {
    if (window.location.pathname.includes('google-callback') || window.location.search.includes('code=')) {
      return 'upi';
    }
    if (window.location.hash === '#privacy' || window.location.pathname === '/privacy' || window.location.pathname === '/privacy.html') {
      return 'privacy';
    }
    if (window.location.hash === '#analysis' || window.location.hash === '#cashflow') {
      return 'analysis';
    }
    return 'home';
  });
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const currentMonthString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentYearString = today.getFullYear().toString();

  const [txFilterType, setTxFilterType] = useState('all');
  const [txFilterValue, setTxFilterValue] = useState('');
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
      try {
        localStorage.setItem('cached_balances', JSON.stringify(res.data));
      } catch (e) {}
    } catch (error) {
      console.error("Failed to load wallets:", error);
    }
  };

  const loadTransactions = async () => {
    try {
      if (transactions.length === 0) setTxLoading(true);
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
      const sorted = (res.data || []).slice().sort((a, b) => {
        const timeA = new Date(a.date || a.txnDate).getTime();
        const timeB = new Date(b.date || b.txnDate).getTime();
        if (timeB !== timeA) return timeB - timeA;
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdB - createdA;
      });
      setTransactions(sorted);
      if (txFilterType === 'all' && txWalletFilter === 'all') {
        try {
          localStorage.setItem('cached_transactions', JSON.stringify(sorted.slice(0, 100)));
        } catch (e) {}
      }
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
    const handleAuthError = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('bank_sync_settings_cache');
      localStorage.removeItem('bank_overview_cache');
      localStorage.removeItem('tmb_wizard_step');
      sessionStorage.clear();
      try {
        sessionStorage.setItem('skip_splash', 'true');
      } catch (e) {
        console.warn(e);
      }
      setHasSessionSplashShown(true);
      setIsAuthenticated(false);
      setCurrentUser({});
      setBalances({ cash: 0, upi: 0, total: 0 });
      setTransactions([]);
      setTxLoading(true);
      setActiveTab('home');
      setShowProfileTooltip(false);
    };
    const handleUserUpdate = () => setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}'));
    
    window.addEventListener('auth_error', handleAuthError);
    window.addEventListener('user_updated', handleUserUpdate);
    
    return () => {
      window.removeEventListener('auth_error', handleAuthError);
      window.removeEventListener('user_updated', handleUserUpdate);
    };
  }, []);

  // Android hardware back button & Groww-style double-tap exit logic
  const [showExitToast, setShowExitToast] = useState(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const lastBackPressTimeRef = useRef(0);

  const handleAppExit = async () => {
    try {
      setShowExitToast(false);
      await CapApp.exitApp();
    } catch {
      window.close();
    }
  };

  const handleBackAction = () => {
    // 1. Dispatch custom event so nested views/modals can intercept
    const backEvent = new CustomEvent('hardwareBackPress', { cancelable: true });
    const notPrevented = window.dispatchEvent(backEvent);
    if (!notPrevented) {
      // Handled by child component (e.g. Account sub-setting or UPI modal)
      return;
    }

    // 2. If on any tab other than 'home', navigate back to 'home'
    if (activeTabRef.current !== 'home') {
      setActiveTab('home');
      setShowExitToast(false);
      return;
    }

    // 3. User is on 'home' page: check double-tap back within 2.5 seconds (like Groww)
    const now = Date.now();
    if (now - lastBackPressTimeRef.current < 2500) {
      // Second back press on Home within 2.5s — exit app!
      handleAppExit();
    } else {
      // First back press on Home — show Groww-style exit toast!
      lastBackPressTimeRef.current = now;
      setShowExitToast(true);
    }
  };

  // Auto-dismiss the exit toast after 2.5 seconds
  useEffect(() => {
    if (!showExitToast) return;
    const timer = setTimeout(() => {
      setShowExitToast(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [showExitToast]);

  // Capacitor native Android hardware back button handler
  useEffect(() => {
    let backListenerHandle = null;

    const registerCapacitorBack = async () => {
      try {
        backListenerHandle = await CapApp.addListener('backButton', () => {
          handleBackAction();
        });
      } catch (err) {
        console.debug('Capacitor backButton listener not active on web:', err);
      }
    };

    registerCapacitorBack();

    return () => {
      if (backListenerHandle?.remove) {
        backListenerHandle.remove();
      }
    };
  }, []);

  // Web browser popstate handling (PWA / mobile browser fallback)
  useEffect(() => {
    if (window.history.state?.tab !== activeTab) {
      window.history.pushState({ tab: activeTab }, '', window.location.href);
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = (e) => {
      window.history.pushState({ tab: activeTabRef.current }, '', window.location.href);
      handleBackAction();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('bank_sync_settings_cache');
    localStorage.removeItem('bank_overview_cache');
    localStorage.removeItem('tmb_wizard_step');
    sessionStorage.clear();
    try {
      sessionStorage.setItem('skip_splash', 'true');
    } catch (e) {
      console.warn(e);
    }
    setHasSessionSplashShown(true);
    setIsAuthenticated(false);
    setCurrentUser({});
    setBalances({ cash: 0, upi: 0, total: 0 });
    setTransactions([]);
    setTxLoading(true);
    setActiveTab('home');
    setShowProfileTooltip(false);
    setTxFilterType('all');
    setTxFilterValue('');
    setTxWalletFilter('all');
  };

  const handleAuthSuccess = (userData) => {
    const user = userData || JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
    setBalances({ cash: 0, upi: 0, total: 0 });
    setTransactions([]);
    setTxLoading(true);
    setActiveTab('home');
    setIsAuthenticated(true);
  };

  useEffect(() => {
    if (isAuthenticated) loadWallets();
  }, [isAuthenticated, activeTab, currentUser?.email, currentUser?._id, currentUser?.id]);

  useEffect(() => {
    const handleSyncUpdated = () => {
      loadWallets();
      loadTransactions();
    };
    window.addEventListener('bank_sync_updated', handleSyncUpdated);
    window.addEventListener('focus', loadWallets);
    return () => {
      window.removeEventListener('bank_sync_updated', handleSyncUpdated);
      window.removeEventListener('focus', loadWallets);
    };
  }, []);

  const effectiveUpiBalance = useMemo(() => {
    if (Array.isArray(transactions) && transactions.length > 0) {
      const latestBankTx = transactions.find(t => t.wallet === 'UPI' && t.balance !== null && t.balance !== undefined && !isNaN(t.balance));
      if (latestBankTx) {
        return Number(latestBankTx.balance);
      }
    }
    return Number(balances.upi || 0);
  }, [transactions, balances.upi]);

  const effectiveBalances = useMemo(() => {
    const cash = Number(balances.cash || 0);
    const upi = effectiveUpiBalance;
    return {
      cash,
      upi,
      total: cash + upi
    };
  }, [balances.cash, effectiveUpiBalance]);

  useEffect(() => {
    if (isAuthenticated) loadTransactions();
  }, [txFilterType, txFilterValue, txWalletFilter, isAuthenticated, currentUser?.email, currentUser?._id, currentUser?.id]);

  // Quiet background prefetch of all-time analysis summary so Analysis tab opens in 0ms
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      getSummary({})
        .then(res => {
          try {
            sessionStorage.setItem('summary_all_', JSON.stringify(res.data));
          } catch (e) {}
        })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [isAuthenticated, transactions.length]);

  // Automatic background bank sync on app login if user has bank sync active
  useEffect(() => {
    if (!isAuthenticated) return;
    const lastSessionSync = sessionStorage.getItem('last_auto_sync_session');
    const nowMs = Date.now();
    const shouldAutoSync = !lastSessionSync || (nowMs - Number(lastSessionSync) > 15 * 60 * 1000);
    if (!shouldAutoSync) return;

    const checkAndSync = async () => {
      try {
        let isConfigured = false;
        try {
          const cached = localStorage.getItem('bank_sync_settings_cache');
          if (cached) {
            const d = JSON.parse(cached);
            isConfigured = Boolean(d.hasGoogleAuth && !d.googleTokenExpired && d.hasPassword);
          }
        } catch {}

        if (!isConfigured) {
          const res = await getBankSyncSettings();
          const d = res.data;
          isConfigured = Boolean(d.hasGoogleAuth && !d.googleTokenExpired && d.hasPassword);
        }

        if (isConfigured) {
          sessionStorage.setItem('last_auto_sync_session', String(nowMs));
          sessionStorage.setItem('is_syncing_gmail', 'true');
          window.dispatchEvent(new Event('bank_sync_status_changed'));

          syncGmailNow()
            .then(res => {
              if ((res.data?.statementsProcessed || 0) > 0 || (res.data?.addedCount || 0) > 0) {
                loadWallets();
                loadTransactions();
                window.dispatchEvent(new Event('bank_sync_updated'));
              }
            })
            .catch(() => {})
            .finally(() => {
              sessionStorage.removeItem('is_syncing_gmail');
              window.dispatchEvent(new Event('bank_sync_status_changed'));
            });
        }
      } catch {}
    };

    checkAndSync();
  }, [isAuthenticated, currentUser?.email, currentUser?._id, currentUser?.id]);

  if (showSplash) {
    return (
      <IntroSplash 
        onFinish={() => {
          setShowSplash(false);
          setHasSessionSplashShown(true);
          try {
            sessionStorage.setItem('skip_splash', 'true');
          } catch {}
        }} 
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <SystemStatusOverlay />
        <AuthScreen 
          onAuthSuccess={handleAuthSuccess} 
          initialSkipSplash={hasSessionSplashShown}
        />
      </>
    );
  }

  return (
    <div 
      key={currentUser?._id || currentUser?.id || currentUser?.email || 'authenticated-app'}
      className={`app-layout ${activeTab === 'cash' ? 'bg-blush-cash' : ''} ${activeTab === 'upi' ? 'bg-blush-upi' : ''} ${activeTab === 'account' ? 'bg-blush-account' : ''}`}
    >
      <SystemStatusOverlay />
      {/* Sidebar (Desktop) */}
      <aside className="sidebar">
        <div 
          className="sidebar-brand-block" 
          onClick={() => setActiveTab('home')} 
          title="Smart Expense Tracker"
        >
          <span className="sidebar-brand-title">Smart Expense</span>
          <div className="sidebar-brand-swoosh">
            <svg viewBox="0 0 460 48" fill="none" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              <path d="M 12 22 C 145 42, 315 42, 438 12" stroke="#00d084" strokeWidth="6.5" strokeLinecap="round" />
              <circle cx="441" cy="11" r="7.5" fill="#00d084" />
            </svg>
          </div>
          <div className="sidebar-brand-tracker">
            <span>T</span><span>R</span><span>A</span><span>C</span><span>K</span><span>E</span><span>R</span>
          </div>
        </div>
        <div 
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <Home size={20} />
          <span>Dashboard</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'cash' ? 'active' : ''}`}
          onClick={() => setActiveTab('cash')}
        >
          <Coins size={20} />
          <span>Cash</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'upi' ? 'active' : ''}`}
          onClick={() => setActiveTab('upi')}
        >
          <CreditCard size={20} />
          <span>UPI</span>
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
        <header className="header">
          <div className="header-brand-group">
            <div 
              className="header-mobile-brand" 
              onClick={() => setActiveTab('home')} 
              title="Smart Expense Tracker"
            >
              <span className="header-mobile-brand-title">Smart Expense</span>
              <div className="header-mobile-brand-swoosh">
                <svg viewBox="0 0 460 48" fill="none" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                  <path d="M 12 22 C 145 42, 315 42, 438 12" stroke="#00d084" strokeWidth="6" strokeLinecap="round" />
                  <circle cx="441" cy="11" r="7.5" fill="#00d084" />
                </svg>
              </div>
              <div className="header-mobile-brand-tracker">
                <span>T</span><span>R</span><span>A</span><span>C</span><span>K</span><span>E</span><span>R</span>
              </div>
            </div>
            <h1 className="header-page-title">
              {activeTab === 'home' && 'Dashboard'}
              {activeTab === 'cash' && 'Cash Management'}
              {activeTab === 'upi' && 'UPI Transactions'}
              {activeTab === 'budget' && 'Budget & Savings'}
              {activeTab === 'analysis' && 'Analysis & Insights'}
              {activeTab === 'account' && 'My Account'}
            </h1>
          </div>
          <div className="header-actions">
            <button 
              onClick={toggleTheme}
              className="icon-btn"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div 
              style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
              onMouseEnter={() => setShowProfileTooltip(true)}
              onMouseLeave={() => setShowProfileTooltip(false)}
            >
              <div 
                className={`profile-avatar ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => setActiveTab('account')}
                title={currentUser.username || currentUser.name || 'User Profile & Settings'}
                role="button"
                tabIndex={0}
              >
                {currentUser.profileImage ? (
                  <img src={currentUser.profileImage} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (currentUser.username || currentUser.name || currentUser.email || 'L').charAt(0).toUpperCase()
                )}
              </div>
              {showProfileTooltip && (
                <div className="glass animate-fade-in" style={{
                  position: 'absolute', top: '120%', right: '50%', transform: 'translateX(50%)',
                  padding: '0.75rem 1rem', borderRadius: '8px', zIndex: 1000,
                  whiteSpace: 'nowrap', textAlign: 'center', border: '1px solid var(--border)',
                  boxShadow: 'var(--card-shadow)', background: 'var(--bg-card)'
                }}>
                  <p style={{ margin: '0 0 0.25rem 0', fontWeight: '600', color: 'var(--text-primary)' }}>{currentUser.username || currentUser.name || 'User'}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{currentUser.email}</p>
                </div>
              )}
            </div>

            <button 
              onClick={handleLogout}
              className="logout-btn"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main>
          {activeTab === 'home' && (
            <>
              <Dashboard balances={effectiveBalances} onOpenSetupGuide={() => setActiveTab('upi')} />

              <div className="main-content" style={{ marginTop: '2rem' }}>
                <div className="action-cards" style={{ gridColumn: '1 / -1' }}>
                  <TransactionsTable
                    title={txFilterType === 'all' ? 'All Transactions' : getDashboardFeedTitle()}
                    badge={`Showing ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`}
                    transactions={transactions}
                    loading={txLoading}
                    onDelete={handleDeleteTransaction}
                    onEditComplete={refreshAllData}
                    hideCategory={false}
                    hideActions={true}
                    hideWallet={false}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'cash' && (
            <CashView 
              refreshAllData={refreshAllData}
              transactions={transactions}
              txLoading={txLoading}
              handleDeleteTransaction={handleDeleteTransaction}
              getCurrency={getCurrency}
            />
          )}

          {activeTab === 'upi' && (
            <UpiView 
              refreshAllData={refreshAllData}
              transactions={transactions}
              txLoading={txLoading}
              handleDeleteTransaction={handleDeleteTransaction}
              getCurrency={getCurrency}
              currentUser={currentUser}
              balances={balances}
            />
          )}

          {activeTab === 'budget' && (
            <div style={{ marginTop: '2rem' }}>
              <BudgetView transactions={transactions} />
            </div>
          )}

          {activeTab === 'analysis' && (
            <div style={{ marginTop: '0.5rem', marginBottom: '2rem' }}>
              <ErrorBoundary>
                <AnalysisView refreshTrigger={transactions} />
              </ErrorBoundary>
            </div>
          )}

          {activeTab === 'account' && (
            <div style={{ marginTop: '2rem' }}>
              <AccountView currentUser={currentUser} theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} />
            </div>
          )}

          {activeTab === 'privacy' && (
            <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
              <PrivacyPolicy onBack={() => setActiveTab('home')} />
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
          className={`bottom-nav-item ${activeTab === 'cash' ? 'active' : ''}`}
          onClick={() => setActiveTab('cash')}
        >
          <Coins size={22} />
          <span>Cash</span>
        </div>
        <div 
          className={`bottom-nav-item ${activeTab === 'upi' ? 'active' : ''}`}
          onClick={() => setActiveTab('upi')}
        >
          <CreditCard size={22} />
          <span>UPI</span>
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
      </nav>

      {/* Groww-style Exit Toast (shown only on Home screen back press) */}
      {showExitToast && (
        <div className="groww-exit-toast">
          <div className="groww-exit-toast-icon">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
              <path d="M 3 13 C 9 19, 16 19, 21 8" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <span>Press back again to exit Smart Expense</span>
        </div>
      )}
    </div>
  );
}

export default App;
