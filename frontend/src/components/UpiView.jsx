import React, { useState, useEffect, useRef, useMemo } from 'react';
import TransactionForm from './TransactionForm';
import TransactionsTable from './TransactionsTable';
import {
  Smartphone, FileText, UploadCloud, CheckCircle2, AlertCircle,
  RefreshCw, Eye, EyeOff, ShieldCheck, Mail, Key, HelpCircle,
  ChevronDown, ChevronUp, LogOut, Check, ArrowRight, ArrowLeft,
  ExternalLink, Building2, Lock, Sparkles, Clock, Settings, Copy, Download, Trash2
} from 'lucide-react';
import {
  getBankSyncSettings,
  getBankOverview,
  updateBankSyncSettings,
  uploadStatementPdf,
  syncGmailNow,
  disconnectGmail,
  deleteBankSyncConfig,
  getGoogleAuthUrl,
  connectGoogleAccount
} from '../services/api';

// Supported & Upcoming Indian Banks
const SUPPORTED_BANKS = [
  {
    id: 'tmb',
    name: 'Tamilnad Mercantile Bank',
    shortName: 'TMB Bank',
    active: true,
    tag: 'Supported Now',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    badgeColor: '#10b981'
  },
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    shortName: 'HDFC Bank',
    active: false,
    tag: 'Feature Engagement',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.08)',
    badgeColor: '#64748b'
  },
  {
    id: 'sbi',
    name: 'State Bank of India',
    shortName: 'SBI',
    active: false,
    tag: 'Feature Engagement',
    color: '#0284c7',
    bgColor: 'rgba(2, 132, 199, 0.08)',
    badgeColor: '#64748b'
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    shortName: 'ICICI Bank',
    active: false,
    tag: 'Feature Engagement',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.08)',
    badgeColor: '#64748b'
  },
  {
    id: 'axis',
    name: 'Axis Bank',
    shortName: 'Axis Bank',
    active: false,
    tag: 'Feature Engagement',
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.08)',
    badgeColor: '#64748b'
  },
  {
    id: 'kotak',
    name: 'Kotak Mahindra Bank',
    shortName: 'Kotak Bank',
    active: false,
    tag: 'Feature Engagement',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.08)',
    badgeColor: '#64748b'
  }
];

const UpiView = ({ refreshAllData, transactions, txLoading, handleDeleteTransaction, currentUser }) => {
  const [mainTab, setMainTab] = useState('auto');
  const [subTab, setSubTab] = useState('add');

  // Wizard state: 1 = Bank Selection, 2 = Credentials & Password
  const [wizardStep, setWizardStep] = useState(() => {
    const saved = localStorage.getItem('tmb_wizard_step');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [selectedBank, setSelectedBank] = useState('tmb');
  const [hoveredBankId, setHoveredBankId] = useState(null);

  const goToStep = (step) => {
    setWizardStep(step);
    localStorage.setItem('tmb_wizard_step', String(step));
  };

  // Settings & Connection state (initialized instantly from localStorage cache if available)
  const cachedSettings = useMemo(() => {
    try {
      const saved = localStorage.getItem('bank_sync_settings_cache');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const cachedOverview = useMemo(() => {
    try {
      const saved = localStorage.getItem('bank_overview_cache');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const [settingsLoading, setSettingsLoading] = useState(() => !cachedSettings);
  const [hasPassword, setHasPassword] = useState(() => Boolean(cachedSettings?.hasPassword));
  const [maskedPassword, setMaskedPassword] = useState(() => cachedSettings?.maskedPassword || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Google credentials & Bank Email
  const [googleEmail, setGoogleEmail] = useState(() => cachedSettings?.googleEmail || null);
  const [targetBankEmail, setTargetBankEmail] = useState(() => cachedSettings?.googleEmail || currentUser?.email || '');
  const [hasGoogleAuth, setHasGoogleAuth] = useState(() => Boolean(cachedSettings?.hasGoogleAuth));
  const [googleTokenExpired, setGoogleTokenExpired] = useState(() => Boolean(cachedSettings?.googleTokenExpired));
  const [hasGoogleCredentials, setHasGoogleCredentials] = useState(() => Boolean(cachedSettings?.hasGoogleCredentials || cachedSettings?.googleClientId));
  const [googleClientId, setGoogleClientId] = useState(() => cachedSettings?.googleClientId || '');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const handlePasswordChange = (val) => {
    setPasswordInput(val);
  };

  const handleBankEmailChange = (val) => {
    setTargetBankEmail(val);
  };

  const handleClientIdChange = (val) => {
    setGoogleClientId(val);
  };

  const handleClientSecretChange = (val) => {
    setGoogleClientSecret(val);
  };

  // Status & action state
  const [isConfigured, setIsConfigured] = useState(() => {
    if (cachedSettings) {
      return Boolean(cachedSettings?.hasPassword && (cachedSettings?.hasGoogleAuth || cachedSettings?.bankSyncActive));
    }
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.bankSyncActive || u.statementPassword || (u.linkedBanks && u.linkedBanks.length > 0)) {
          return true;
        }
      }
    } catch {}
    if (transactions && transactions.some(t => t.source === 'bank_sync' || t.source === 'statement_import')) {
      return true;
    }
    return false;
  });
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [savingSetup, setSavingSetup] = useState(false);
  const [showDropzone, setShowDropzone] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(() => cachedSettings?.lastBankSyncAt ? new Date(cachedSettings.lastBankSyncAt) : null);
  const [bankOverview, setBankOverview] = useState(() => cachedOverview || null);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showDailySummaries, setShowDailySummaries] = useState(true);

  // Consent & Success Animation States
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const fileInputRef = useRef(null);
  const hasAutoSyncedRef = useRef(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadGuidePdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to open the PDF printable guide.');
      return;
    }
    const originUrl = window.location.origin;
    const redirectUrl = `${window.location.origin}/google-callback`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Cloud OAuth & Bank Sync Setup Guide - Cash & UPI Tracker</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              color: #0f172a;
              border-bottom: 3px solid #6366f1;
              padding-bottom: 12px;
              font-size: 24px;
              margin-bottom: 6px;
            }
            .subtitle {
              color: #64748b;
              font-size: 14px;
              margin-bottom: 24px;
            }
            .step-card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 16px 20px;
              margin-bottom: 16px;
              page-break-inside: avoid;
            }
            .step-title {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .badge {
              background: #6366f1;
              color: white;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: bold;
            }
            code {
              background: #e2e8f0;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: monospace;
              color: #0f172a;
              font-size: 13px;
              font-weight: 600;
            }
            .url-box {
              background: #0f172a;
              color: #38bdf8;
              padding: 10px 14px;
              border-radius: 6px;
              font-family: monospace;
              font-size: 13px;
              margin: 6px 0;
              word-break: break-all;
            }
            .tip-box {
              background: #ecfdf5;
              border: 1px solid #a7f3d0;
              border-radius: 8px;
              padding: 14px 18px;
              color: #065f46;
              margin-top: 20px;
              font-size: 13px;
            }
            @media print {
              body { padding: 15px; }
            }
          </style>
        </head>
        <body>
          <h1>Google Cloud OAuth & Bank Sync Setup Guide</h1>
          <div class="subtitle">Cash & UPI Tracker • Step-by-Step Configuration</div>

          <div class="step-card">
            <div class="step-title"><span class="badge">Step 1</span> App Information (Google Auth Platform)</div>
            <p>In <strong>Google Cloud Console → Google Auth Platform → Overview / Branding</strong>:</p>
            <ul>
              <li><strong>App name:</strong> <code>Cash & UPI Tracker</code></li>
              <li><strong>User support email:</strong> Select your personal email address</li>
              <li>Click <strong>Next</strong></li>
            </ul>
          </div>

          <div class="step-card">
            <div class="step-title"><span class="badge">Step 2</span> Audience & Test Users</div>
            <ul>
              <li>Under <strong>User type</strong>, select: <strong>External</strong></li>
              <li>Under <strong>Test users</strong> (or Audience tab): Click <strong>+ ADD USERS</strong> and enter your Gmail address (<code>lourdurajsebastin350@gmail.com</code>). <em>(Or click 'Publish App' to allow any account).</em></li>
              <li>Click <strong>Next / Save</strong></li>
            </ul>
          </div>

          <div class="step-card">
            <div class="step-title"><span class="badge">Step 3</span> Contact Information</div>
            <ul>
              <li><strong>Developer contact email:</strong> Enter your email address</li>
              <li>Click <strong>Next</strong>, then review and click <strong>Create / Finish</strong></li>
            </ul>
          </div>

          <div class="step-card">
            <div class="step-title"><span class="badge">Step 4</span> Enable Gmail API</div>
            <ul>
              <li>In top search bar, type <strong>Gmail API</strong> (or APIs & Services → Library)</li>
              <li>Click on <strong>Gmail API</strong> and click the blue <strong>ENABLE</strong> button</li>
            </ul>
          </div>

          <div class="step-card">
            <div class="step-title"><span class="badge">Step 5</span> Create OAuth Web Client Credentials</div>
            <p>Go to <strong>Clients (Credentials) → + Create Credentials → OAuth client ID</strong>:</p>
            <ul>
              <li><strong>Application type:</strong> Select <strong>Web application</strong></li>
              <li><strong>Name:</strong> <code>Cash UPI Web App</code></li>
            </ul>
            
            <p><strong>Authorized JavaScript origins:</strong></p>
            <div class="url-box">${originUrl}</div>

            <p><strong>Authorized redirect URIs:</strong></p>
            <div class="url-box">${redirectUrl}</div>

            <p>Click <strong>Create</strong>. Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> into the Cash & UPI Tracker app.</p>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 1.5s maximum fallback timer so UI never hangs
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettingsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Fetch bank sync settings on mount
  const fetchSettings = async () => {
    try {
      if (!cachedSettings) {
        setSettingsLoading(true);
      }
      const res = await getBankSyncSettings();
      const data = res.data;
      
      try {
        localStorage.setItem('bank_sync_settings_cache', JSON.stringify(data));
      } catch {}

      const pwdActive = Boolean(data.hasPassword);
      setHasPassword(pwdActive);
      setMaskedPassword(data.maskedPassword || '');
      
      const email = data.googleEmail || null;
      setGoogleEmail(email);
      setTargetBankEmail(data.googleEmail || currentUser?.email || '');

      if (data.googleClientId) {
        setGoogleClientId(data.googleClientId);
      }

      const credsActive = Boolean(data.hasGoogleCredentials || data.googleClientId);
      setHasGoogleCredentials(credsActive);

      const authActive = Boolean(data.hasGoogleAuth);
      setHasGoogleAuth(authActive);
      const tokenExpired = Boolean(data.googleTokenExpired);
      setGoogleTokenExpired(tokenExpired);

      if (data.lastBankSyncAt) {
        setLastSyncTime(new Date(data.lastBankSyncAt));
      } else {
        setLastSyncTime(null);
      }

      // Check if user is genuinely configured in DB (password saved and Google auth or active sync)
      const userConfigured = Boolean(data.hasPassword && (data.hasGoogleAuth || data.bankSyncActive));

      if (userConfigured) {
        setIsConfigured(true);

        // Fetch dynamic Customer & Branch details and Daily Statement summaries
        getBankOverview()
          .then(ovRes => {
            if (ovRes.data) {
              setBankOverview(ovRes.data);
              try {
                localStorage.setItem('bank_overview_cache', JSON.stringify(ovRes.data));
              } catch {}
            }
          })
          .catch(() => {});

        // Silent check for newly arrived statements on load (run once per 15 min session)
        const lastSessionSync = sessionStorage.getItem('last_auto_sync_session');
        const nowMs = Date.now();
        const shouldAutoSync = !lastSessionSync || (nowMs - Number(lastSessionSync) > 15 * 60 * 1000);

        if (data.hasGoogleAuth && !tokenExpired && data.hasPassword && shouldAutoSync) {
          sessionStorage.setItem('last_auto_sync_session', String(nowMs));
          const isInitialFullSync = !data.lastBankSyncAt;
          syncGmailNow({ fullSync: isInitialFullSync })
            .then(syncRes => {
              if ((syncRes.data?.statementsProcessed || 0) > 0 || (syncRes.data?.addedCount || 0) > 0) {
                const now = new Date();
                setLastSyncTime(now);
                refreshAllData();
                getBankOverview()
                  .then(ovRes => {
                    if (ovRes.data) {
                      setBankOverview(ovRes.data);
                      try {
                        localStorage.setItem('bank_overview_cache', JSON.stringify(ovRes.data));
                      } catch {}
                    }
                  })
                  .catch(() => {});
              }
            })
            .catch((syncErr) => {
              if (syncErr.response?.data?.code === 'GMAIL_TOKEN_EXPIRED') {
                setGoogleTokenExpired(true);
                setHasGoogleAuth(false);
              }
            });
        }
      } else {
        setIsConfigured(false);
        setBankOverview(null);
        setLastSyncTime(null);
        setMaskedPassword('');
        setWizardStep(1);
        try {
          localStorage.removeItem('bank_sync_settings_cache');
          localStorage.removeItem('bank_overview_cache');
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load bank sync settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    // Check if returning from Google OAuth redirect (?code=...)
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      const redirectUri = window.location.origin + '/google-callback';
      window.history.replaceState({}, document.title, window.location.pathname.replace(/\/google-callback.*/, '/') || '/');
      connectGoogleAccount({ code, redirectUri })
        .then(async res => {
          setHasGoogleAuth(true);
          setGoogleTokenExpired(false);
          if (res.data?.email) {
            setGoogleEmail(res.data.email);
          }
          setIsConfigured(true);
          
          setAlertInfo({
            type: 'success',
            message: `🎉 Google account connected! Scanning your inbox for all past & current statements...`
          });

          // Trigger full inbox historical sync immediately
          try {
            setSyncingGmail(true);
            const syncRes = await syncGmailNow({ fullSync: true });
            const count = syncRes.data?.statementsProcessed || 0;
            const added = syncRes.data?.addedCount || 0;
            setAlertInfo({
              type: 'success',
              message: `🎉 Auto-Sync Active! Synced ${count} statement(s) from your inbox (+${added} transactions). Tomorrow's statements will sync automatically!`
            });
            const now = new Date();
            setLastSyncTime(now);
            refreshAllData();
          } catch (syncErr) {
            console.warn('Initial sync warning:', syncErr.message);
          } finally {
            setSyncingGmail(false);
          }
          fetchSettings();
        })
        .catch(err => {
          setAlertInfo({
            type: 'error',
            message: err.response?.data?.message || 'Failed to complete Google authorization.'
          });
          fetchSettings();
        });
    } else {
      fetchSettings();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const handleSyncUpdated = () => {
      fetchSettings();
    };
    window.addEventListener('bank_sync_updated', handleSyncUpdated);
    return () => window.removeEventListener('bank_sync_updated', handleSyncUpdated);
  }, []);

  // Step 2: Open Secure Consent Modal before connecting
  const handleInitiateConnect = (e) => {
    e?.preventDefault();
    if (!passwordInput.trim() && !hasPassword) {
      setAlertInfo({ type: 'error', message: 'Statement opening password is required before connecting.' });
      return;
    }
    setAlertInfo(null);
    setConsentAgreed(false);
    setShowConsentModal(true);
  };

  // Step 2 Confirmed: User ticks checkbox and clicks Authorize & Continue with Google
  const handleConfirmAuthorization = async () => {
    setSavingSetup(true);
    setAlertInfo(null);
    try {
      const payload = {};
      if (passwordInput.trim()) payload.statementPassword = passwordInput.trim();
      if (googleClientId.trim()) payload.googleClientId = googleClientId.trim();
      if (googleClientSecret.trim()) payload.googleClientSecret = googleClientSecret.trim();
      if (targetBankEmail.trim()) payload.googleEmail = targetBankEmail.trim();
      payload.bankSyncActive = true;

      await updateBankSyncSettings(payload);

      setHasPassword(true);
      if (passwordInput.trim()) {
        setMaskedPassword('••••' + passwordInput.trim().slice(-4));
      }

      // Close modal and redirect directly to Google OAuth
      setShowConsentModal(false);
      const redirectUri = window.location.origin + '/google-callback';
      const res = await getGoogleAuthUrl({ redirectUri });
      if (res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        setAlertInfo({
          type: 'error',
          message: 'Could not obtain Google authentication URL. Please try again.'
        });
      }

    } catch (err) {
      setAlertInfo({
        type: 'error',
        message: err.response?.data?.message || 'Failed to initialize Google authorization.'
      });
      setShowConsentModal(false);
    } finally {
      setSavingSetup(false);
    }
  };

  // Trigger Google OAuth connection
  const handleConnectGmail = async () => {
    try {
      setAlertInfo(null);
      const redirectUri = window.location.origin + '/google-callback';
      const loginHint = googleEmail || targetBankEmail || currentUser?.email;
      const res = await getGoogleAuthUrl({ redirectUri, loginHint });
      if (res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Please enter and save your Google Client ID & Secret below first.';
      setAlertInfo({ type: 'error', message: msg });
      setShowGuide(true);
    }
  };

  // Disconnect Google account
  const handleDisconnectGmail = async () => {
    if (!window.confirm('Disconnect your Gmail account from bank auto-sync?')) return;
    try {
      await disconnectGmail();
      setGoogleEmail(null);
      setHasGoogleAuth(false);
      localStorage.removeItem('bank_sync_configured');
      localStorage.removeItem('bank_has_google_auth');
      localStorage.removeItem('bank_google_email');
      localStorage.removeItem('bank_has_credentials');
      localStorage.removeItem('bank_overview_cache');
      localStorage.removeItem('bank_last_sync_time');
      setIsConfigured(false);
      window.dispatchEvent(new Event('bank_sync_updated'));
      setAlertInfo({ type: 'success', message: 'Gmail disconnected.' });
    } catch (err) {
      setAlertInfo({ type: 'error', message: 'Failed to disconnect.' });
    }
  };

  // Sync Gmail Now (user-triggered or automated)
  const handleSyncGmailNow = async (options = {}) => {
    if (!hasPassword) {
      setAlertInfo({ type: 'error', message: 'Statement password is required to decrypt statements.' });
      return;
    }
    if (!hasGoogleAuth || googleTokenExpired) {
      setAlertInfo({
        type: 'error',
        message: 'Gmail authorization expired or not connected. Click "Re-link Gmail" to authorize.'
      });
      return;
    }

    setSyncingGmail(true);
    setAlertInfo(null);
    try {
      const res = await syncGmailNow(options);
      const processed = res.data?.statementsProcessed || 0;
      const added = res.data?.addedCount || 0;
      const skipped = res.data?.skippedCount || 0;

      if (processed > 0 || added > 0) {
        const now = new Date();
        setLastSyncTime(now);
        localStorage.setItem('bank_last_sync_time', now.toISOString());
        refreshAllData();
        getBankOverview()
          .then(ovRes => {
            if (ovRes.data) {
              setBankOverview(ovRes.data);
              try {
                localStorage.setItem('bank_overview_cache', JSON.stringify(ovRes.data));
              } catch (e) {}
            }
          })
          .catch(() => {});
        setAlertInfo({
          type: 'success',
          message: `✅ Sync complete! Processed ${processed} statement(s), added ${added} new transactions (${skipped} duplicates skipped).`
        });
      } else {
        const now = new Date();
        setLastSyncTime(now);
        setAlertInfo({
          type: 'success',
          message: res.data?.message || 'All bank statements are up to date! Waiting for the next daily statement from your bank.'
        });
      }
    } catch (err) {
      console.log('Sync check error:', err.message);
      if (err.response?.data?.code === 'GMAIL_TOKEN_EXPIRED' || err.response?.data?.message?.includes('expired') || err.message?.includes('invalid_grant')) {
        setGoogleTokenExpired(true);
        setHasGoogleAuth(false);
        setAlertInfo({
          type: 'error',
          message: '⚠️ Google authorization has expired (Google limits test app tokens to 7 days). Please click "Re-link Gmail" above to resume sync.'
        });
      } else {
        setAlertInfo({
          type: 'error',
          message: err.response?.data?.message || 'Failed to sync with Gmail. Please try again.'
        });
      }
    } finally {
      setSyncingGmail(false);
    }
  };

  // Handle PDF file selection or drag & drop
  const handleFileDrop = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setAlertInfo({ type: 'error', message: 'Please select a valid PDF file (.pdf).' });
      return;
    }

    if (!hasPassword && !passwordInput.trim()) {
      setAlertInfo({
        type: 'error',
        message: '⚠️ Statement password is required! Complete setup to unlock this PDF.'
      });
      return;
    }

    const formData = new FormData();
    formData.append('statementPdf', file);
    if (passwordInput.trim()) {
      formData.append('password', passwordInput.trim());
    }

    setUploadingPdf(true);
    setAlertInfo(null);
    try {
      const res = await uploadStatementPdf(formData);
      setAlertInfo({
        type: 'success',
        message: `✅ Success! ${res.data.message || 'Statement parsed and transactions synced.'}`
      });
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem('bank_last_sync_time', now.toISOString());
      setHasPassword(true);
      setIsConfigured(true);
      localStorage.setItem('bank_sync_configured', 'true');
      setShowDropzone(false);
      window.dispatchEvent(new Event('bank_sync_updated'));
      if (passwordInput.trim()) {
        setMaskedPassword('••••' + passwordInput.trim().slice(-4));
        setPasswordInput('');
      }
      refreshAllData();
      getBankOverview()
        .then(ovRes => {
          if (ovRes.data) {
            setBankOverview(ovRes.data);
            try {
              localStorage.setItem('bank_overview_cache', JSON.stringify(ovRes.data));
            } catch (e) {}
          }
        })
        .catch(() => {});
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'INCORRECT_PASSWORD') {
        setAlertInfo({
          type: 'error',
          message: '❌ Incorrect PDF Password! Could not unlock statement. Please check the "About Your Password" section in your bank email.'
        });
      } else {
        setAlertInfo({
          type: 'error',
          message: data?.message || 'Failed to parse the PDF statement.'
        });
      }
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const autoTransactions = transactions.filter(
    tx => tx.wallet === 'UPI' && tx.entryMode === 'auto'
  );

  const upiTransactions = useMemo(() => {
    return transactions.filter(tx => tx.wallet === 'UPI');
  }, [transactions]);

  // Local time helpers to ensure dates match the user's browser timezone (IST) and avoid UTC midnight day-shifts
  const getLocalDateKey = (dInput) => {
    if (!dInput) return '';
    const d = new Date(dInput);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getLocalMonthKey = (dInput) => {
    if (!dInput) return '';
    const d = new Date(dInput);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const today = new Date();
  const todayLocalDateStr = getLocalDateKey(today);
  const currentLocalMonthStr = getLocalMonthKey(today);
  const currentLocalYearStr = today.getFullYear().toString();

  // Top Table (Daily Statement Ledger) Filter State
  const [ledgerFilterType, setLedgerFilterType] = useState('month');
  const [ledgerFilterValue, setLedgerFilterValue] = useState(currentLocalMonthStr);

  // Bottom Table (Auto Bank & UPI Transactions) Filter State
  const [txFilterType, setTxFilterType] = useState('month');
  const [txFilterValue, setTxFilterValue] = useState(currentLocalMonthStr);

  const [showInitialNotice, setShowInitialNotice] = useState(() => !localStorage.getItem('bank_initial_sync_dismissed'));

  const handleLedgerFilterTypeChange = (newType) => {
    setLedgerFilterType(newType);
    if (newType === 'day') setLedgerFilterValue(todayLocalDateStr);
    else if (newType === 'month') setLedgerFilterValue(currentLocalMonthStr);
    else if (newType === 'year') setLedgerFilterValue(currentLocalYearStr);
    else setLedgerFilterValue('');
  };

  const handleTxFilterTypeChange = (newType) => {
    setTxFilterType(newType);
    if (newType === 'day') setTxFilterValue(todayLocalDateStr);
    else if (newType === 'month') setTxFilterValue(currentLocalMonthStr);
    else if (newType === 'year') setTxFilterValue(currentLocalYearStr);
    else setTxFilterValue('');
  };

  const availableMonths = useMemo(() => {
    const monthsMap = new Map();
    (bankOverview?.dailySummaries || []).forEach(s => {
      const dateStr = s.statementDate || s.period || '';
      const parts = dateStr.split('-');
      if (parts.length >= 3) {
        const m = parts[1];
        const y = parts[2].slice(0, 4);
        const monthKey = `${y}-${m}`;
        if (!monthsMap.has(monthKey)) {
          const sampleDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
          const label = sampleDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          monthsMap.set(monthKey, { key: monthKey, label });
        }
      }
    });
    upiTransactions.forEach(tx => {
      const monthKey = getLocalMonthKey(tx.date || tx.txnDate);
      if (monthKey && !monthsMap.has(monthKey)) {
        const [y, m] = monthKey.split('-');
        const sampleDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        const label = sampleDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        monthsMap.set(monthKey, { key: monthKey, label });
      }
    });
    return Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [upiTransactions, bankOverview?.dailySummaries]);

  const displayedAutoTransactions = useMemo(() => {
    if (txFilterType === 'all') return autoTransactions;

    if (txFilterType === 'today') {
      return autoTransactions.filter(tx => {
        return getLocalDateKey(tx.date || tx.txnDate) === todayLocalDateStr;
      });
    }

    if (txFilterType === 'day') {
      if (!txFilterValue) return autoTransactions;
      return autoTransactions.filter(tx => {
        return getLocalDateKey(tx.date || tx.txnDate) === txFilterValue;
      });
    }

    if (txFilterType === 'month') {
      const activeMonth = txFilterValue || (availableMonths[0]?.key || currentLocalMonthStr);
      return autoTransactions.filter(tx => {
        return getLocalMonthKey(tx.date || tx.txnDate) === activeMonth;
      });
    }

    if (txFilterType === 'year') {
      if (!txFilterValue) return autoTransactions;
      return autoTransactions.filter(tx => {
        const d = new Date(tx.date || tx.txnDate);
        return !isNaN(d.getTime()) && d.getFullYear().toString() === String(txFilterValue);
      });
    }

    return autoTransactions;
  }, [autoTransactions, txFilterType, txFilterValue, todayLocalDateStr, availableMonths, currentLocalMonthStr]);

  const displayedUpiTransactions = useMemo(() => {
    if (txFilterType === 'all') return upiTransactions;

    if (txFilterType === 'today') {
      return upiTransactions.filter(tx => {
        return getLocalDateKey(tx.date || tx.txnDate) === todayLocalDateStr;
      });
    }

    if (txFilterType === 'day') {
      if (!txFilterValue) return upiTransactions;
      return upiTransactions.filter(tx => {
        return getLocalDateKey(tx.date || tx.txnDate) === txFilterValue;
      });
    }

    if (txFilterType === 'month') {
      const activeMonth = txFilterValue || (availableMonths[0]?.key || currentLocalMonthStr);
      return upiTransactions.filter(tx => {
        return getLocalMonthKey(tx.date || tx.txnDate) === activeMonth;
      });
    }

    if (txFilterType === 'year') {
      if (!txFilterValue) return upiTransactions;
      return upiTransactions.filter(tx => {
        const d = new Date(tx.date || tx.txnDate);
        return !isNaN(d.getTime()) && d.getFullYear().toString() === String(txFilterValue);
      });
    }

    return upiTransactions;
  }, [upiTransactions, txFilterType, txFilterValue, todayLocalDateStr, availableMonths, currentLocalMonthStr]);

  const displayedDailySummaries = useMemo(() => {
    const list = bankOverview?.dailySummaries || [];
    if (ledgerFilterType === 'all') return list;

    if (ledgerFilterType === 'today') {
      const [y, m, d] = todayLocalDateStr.split('-');
      const target = `${d}-${m}-${y}`;
      return list.filter(s => (s.statementDate || '').includes(target) || (s.period || '').includes(target));
    }

    if (ledgerFilterType === 'day' && ledgerFilterValue) {
      const [y, m, d] = ledgerFilterValue.split('-');
      const target = `${d}-${m}-${y}`;
      return list.filter(s => (s.statementDate || '').includes(target) || (s.period || '').includes(target));
    }

    if (ledgerFilterType === 'month') {
      const activeMonth = ledgerFilterValue || (availableMonths[0]?.key || currentLocalMonthStr);
      const [y, m] = activeMonth.split('-');
      return list.filter(s => {
        const dateStr = s.statementDate || s.period || '';
        const parts = dateStr.split('-');
        if (parts.length >= 3) {
          return parts[1] === m && parts[2].startsWith(y);
        }
        return true;
      });
    }

    if (ledgerFilterType === 'year' && ledgerFilterValue) {
      return list.filter(s => (s.statementDate || s.period || '').includes(String(ledgerFilterValue)));
    }

    return list;
  }, [bankOverview?.dailySummaries, ledgerFilterType, ledgerFilterValue, todayLocalDateStr, availableMonths, currentLocalMonthStr]);

  const renderLedgerFilterControls = () => (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {ledgerFilterType === 'day' && (
        <input
          type="date"
          className="form-control"
          style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
          value={ledgerFilterValue}
          onChange={e => setLedgerFilterValue(e.target.value)}
        />
      )}
      {ledgerFilterType === 'month' && (
        <select
          className="form-control"
          style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem', fontWeight: 500 }}
          value={ledgerFilterValue || (availableMonths[0]?.key || currentLocalMonthStr)}
          onChange={e => setLedgerFilterValue(e.target.value)}
        >
          {availableMonths.map(m => (
            <option key={`ledger-${m.key}`} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      )}
      {ledgerFilterType === 'year' && (
        <input
          type="number"
          min="2000"
          max="2100"
          placeholder="YYYY"
          className="form-control"
          style={{ width: '90px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
          value={ledgerFilterValue}
          onChange={e => setLedgerFilterValue(e.target.value)}
        />
      )}
      <select
        className="form-control"
        style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}
        value={ledgerFilterType}
        onChange={e => handleLedgerFilterTypeChange(e.target.value)}
      >
        <option value="month">By Month</option>
        <option value="today">Today</option>
        <option value="day">By Day</option>
        <option value="year">By Year</option>
        <option value="all">All Time</option>
      </select>
    </div>
  );

  const renderTxFilterControls = () => (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {txFilterType === 'day' && (
        <input
          type="date"
          className="form-control"
          style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
          value={txFilterValue}
          onChange={e => setTxFilterValue(e.target.value)}
        />
      )}
      {txFilterType === 'month' && (
        <select
          className="form-control"
          style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem', fontWeight: 500 }}
          value={txFilterValue || (availableMonths[0]?.key || currentLocalMonthStr)}
          onChange={e => setTxFilterValue(e.target.value)}
        >
          {availableMonths.map(m => (
            <option key={`tx-${m.key}`} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      )}
      {txFilterType === 'year' && (
        <input
          type="number"
          min="2000"
          max="2100"
          placeholder="YYYY"
          className="form-control"
          style={{ width: '90px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
          value={txFilterValue}
          onChange={e => setTxFilterValue(e.target.value)}
        />
      )}
      <select
        className="form-control"
        style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}
        value={txFilterType}
        onChange={e => handleTxFilterTypeChange(e.target.value)}
      >
        <option value="month">By Month</option>
        <option value="today">Today</option>
        <option value="day">By Day</option>
        <option value="year">By Year</option>
        <option value="all">All Time</option>
      </select>
    </div>
  );

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Non-blocking subtle syncing indicator if initial profile is fetching */}
      {settingsLoading && !cachedSettings && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.45rem 0.9rem',
          borderRadius: '8px',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          color: 'var(--accent-primary, #6366f1)',
          fontSize: '0.82rem',
          marginBottom: '1rem',
          width: 'fit-content'
        }}>
          <RefreshCw size={14} className="animate-spin" />
          <span>Verifying bank profile...</span>
        </div>
      )}
      {/* Main Mode Switcher */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.75rem' }}>
        <button
          className="btn"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            background: mainTab === 'auto' ? 'var(--accent-primary, #6366f1)' : 'var(--empty-state-bg)',
            color: mainTab === 'auto' ? '#fff' : 'var(--text-primary)',
            fontWeight: 600
          }}
          onClick={() => setMainTab('auto')}
        >
          <Building2 size={17} />
          Auto-Tracker-UPI (Bank Sync)
          {isConfigured && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', display: 'inline-block' }} />
          )}
        </button>
        <button
          className="btn"
          style={{
            flex: 1,
            background: mainTab === 'manual' ? 'var(--accent-primary, #6366f1)' : 'var(--empty-state-bg)',
            color: mainTab === 'manual' ? '#fff' : 'var(--text-primary)',
            fontWeight: 600
          }}
          onClick={() => setMainTab('manual')}
        >
          Manual Entry
        </button>
      </div>

      {/* ─── AUTO TAB: PROFESSIONAL BANK SYNC ─── */}
      {mainTab === 'auto' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Alert Message Box */}
          {alertInfo && (
            <div style={{
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              background: alertInfo.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              border: `1px solid ${alertInfo.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              color: alertInfo.type === 'error' ? '#ef4444' : '#10b981',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {alertInfo.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                <span>{alertInfo.message}</span>
              </div>
              <button
                onClick={() => setAlertInfo(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem' }}
              >
                ×
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STATE A: CONFIGURED (COMPACT PROFESSIONAL TOP BAR)
              Takes minimal vertical space & shows live status
          ══════════════════════════════════════════════════════════════ */}
          {isConfigured && (
            <div className="data-card glass animate-fade-in" style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
            }}>
              {/* Left: Status Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* 1. Main Bank Sync Status Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    className={(!googleTokenExpired && (hasGoogleAuth || (isConfigured && settingsLoading))) ? "pulse-dot-green" : "pulse-dot-orange"}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: (!googleTokenExpired && (hasGoogleAuth || (isConfigured && settingsLoading))) ? '#10b981' : '#f59e0b',
                      flexShrink: 0
                    }}
                  />
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {googleTokenExpired
                      ? 'Gmail Session Expired'
                      : (hasGoogleAuth || (isConfigured && settingsLoading))
                        ? 'TMB Bank Auto-Sync Active'
                        : hasGoogleCredentials
                          ? 'Google Credentials Saved'
                          : 'TMB Bank Statement Active'}
                  </strong>
                </div>

                {/* 2. Connection Health Indicator Badge */}
                {googleTokenExpired ? (
                  <button
                    onClick={handleConnectGmail}
                    className="btn"
                    style={{
                      fontSize: '0.78rem',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#fff',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 600,
                      boxShadow: '0 2px 8px rgba(239,68,68,0.3)'
                    }}
                    title="Google refresh token expired after 7-day limit in test mode. Click to re-authorize and resume sync."
                  >
                    <AlertCircle size={12} />
                    Session Expired – Re-link Gmail →
                  </button>
                ) : (hasGoogleAuth || (isConfigured && settingsLoading && localStorage.getItem('bank_has_google_auth') !== 'false')) ? (
                  <span
                    style={{
                      fontSize: '0.76rem',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 600
                    }}
                    title="Google Cloud OAuth authorization is active and verified"
                  >
                    <CheckCircle2 size={12} />
                    Gmail Linked
                  </span>
                ) : hasGoogleCredentials ? (
                  <button
                    onClick={handleConnectGmail}
                    className="btn"
                    style={{
                      fontSize: '0.78rem',
                      background: 'linear-gradient(135deg, #4285f4, #2563eb)',
                      color: '#fff',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 600,
                      boxShadow: '0 2px 8px rgba(66,133,244,0.3)'
                    }}
                    title="Click to authorize with Google so statements can be read from Gmail"
                  >
                    <ExternalLink size={11} />
                    Click to Authorize Gmail →
                  </button>
                ) : null}

                {/* 3. Connected Bank Email Badge */}
                {(googleEmail || targetBankEmail) && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      background: 'rgba(59,130,246,0.1)',
                      color: '#3b82f6',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                    title="Bank registered email"
                  >
                    <Mail size={11} />
                    {googleEmail || targetBankEmail}
                  </span>
                )}

                {/* 4. Masked Bank Account Number */}
                {bankOverview?.accountNo && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: '#818cf8',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 600
                    }}
                    title="Masked TMB Savings Account Number"
                  >
                    <Building2 size={11} />
                    A/C •••• {bankOverview.accountNo.replace(/^X+/, '') || bankOverview.accountNo.slice(-5)}
                  </span>
                )}

                {/* 5. Live Statement Closing Balance */}
                {bankOverview?.latestClosingBalance != null && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      background: 'rgba(56, 189, 248, 0.12)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 700
                    }}
                    title="Official statement Closing Balance synced with wallet"
                  >
                    💰 Balance: ₹{Number(bankOverview.latestClosingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                )}

                {/* 6. Timestamp when data was actually fetched */}
                {lastSyncTime && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <Clock size={13} style={{ color: '#10b981' }} />
                    <span>
                      Last sync: {lastSyncTime.toLocaleDateString() === new Date().toLocaleDateString() ? 'Today' : lastSyncTime.toLocaleDateString()} at {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => handleSyncGmailNow({ fullSync: false })}
                      disabled={syncingGmail || googleTokenExpired || !hasGoogleAuth}
                      style={{
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        color: (syncingGmail || googleTokenExpired || !hasGoogleAuth) ? 'var(--text-secondary)' : '#38bdf8',
                        cursor: (syncingGmail || googleTokenExpired || !hasGoogleAuth) ? 'not-allowed' : 'pointer',
                        padding: '3px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        transition: 'all 0.2s ease',
                        marginLeft: '0.2rem'
                      }}
                      title={googleTokenExpired ? "Please re-link Gmail first" : "Check Gmail for new statements now"}
                    >
                      <RefreshCw size={12} style={{ animation: syncingGmail ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {syncingGmail && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 500
                    }}
                    title="Automatically syncing daily bank statements in background"
                  >
                    <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
                    Auto-syncing...
                  </span>
                )}

                {bankOverview?.customerDetails && (
                  <button
                    onClick={() => setShowBankDetails(b => !b)}
                    className="btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: showBankDetails ? 'var(--accent-primary)' : 'var(--empty-state-bg)',
                      border: '1px solid var(--card-border)',
                      color: showBankDetails ? '#fff' : 'var(--text-primary)',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem'
                    }}
                  >
                    <Building2 size={13} />
                    {showBankDetails ? 'Hide Bank Details ▴' : 'Bank & Branch Details ▾'}
                  </button>
                )}

                <button
                  onClick={() => setShowDropzone(d => !d)}
                  className="btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: showDropzone ? 'var(--accent-primary)' : 'var(--empty-state-bg)',
                    border: '1px solid var(--card-border)',
                    color: showDropzone ? '#fff' : 'var(--text-primary)',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem'
                  }}
                >
                  <UploadCloud size={13} />
                  {showDropzone ? 'Close PDF Drop' : 'Drop Statement'}
                </button>
              </div>
            </div>
          )}

          {/* Optional Droppable Drawer for Statement Testing */}
          {showDropzone && (
            <div
              className="data-card glass animate-fade-in"
              style={{
                padding: '1.5rem',
                border: '2px dashed var(--accent-primary)',
                borderRadius: '14px',
                textAlign: 'center',
                cursor: 'pointer',
                background: uploadingPdf ? 'rgba(99,102,241,0.06)' : 'var(--card-bg)'
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileDrop(e.dataTransfer.files[0]);
                }
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileDrop(e.target.files[0]);
                  }
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <UploadCloud size={28} style={{ color: 'var(--accent-primary)' }} />
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {uploadingPdf ? 'Decrypting & Importing Bank Statement...' : 'Drop Today\'s TMB E-Statement PDF Here to Sync Instantly'}
                </strong>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Auto-decrypts with your saved password and inserts transactions without waiting for tomorrow's email.
                </span>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STATE B: STEP-BY-STEP SETUP WIZARD (When Not Configured)
          ══════════════════════════════════════════════════════════════ */}
          {!isConfigured && (
            <div className="data-card glass animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--card-border)' }}>

              {/* Wizard Steps Navigation Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: wizardStep >= 1 ? 'var(--accent-primary)' : 'var(--empty-state-bg)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}>
                    {wizardStep > 1 ? <Check size={16} /> : '1'}
                  </div>
                  <span style={{ fontWeight: wizardStep === 1 ? 700 : 500, color: wizardStep === 1 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Select Bank
                  </span>
                </div>

                <div style={{ width: 60, height: 2, background: wizardStep > 1 ? 'var(--accent-primary)' : 'var(--card-border)', margin: '0 1rem' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: wizardStep === 2 ? 'var(--accent-primary)' : 'var(--empty-state-bg)',
                    color: wizardStep === 2 ? '#fff' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}>
                    2
                  </div>
                  <span style={{ fontWeight: wizardStep === 2 ? 700 : 500, color: wizardStep === 2 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Credentials & Setup
                  </span>
                </div>
              </div>

              {/* ────────────────────────────────────────────────────────
                  STEP 1: FEATURE CONTENT & SELECT BANK
              ──────────────────────────────────────────────────────── */}
              {wizardStep === 1 && (
                <div className="animate-fade-in">
                  {/* Feature Content Overview */}
                  <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 2rem auto' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'rgba(16,185,129,0.12)',
                      color: '#10b981',
                      padding: '0.3rem 0.8rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      marginBottom: '0.75rem'
                    }}>
                      <Sparkles size={14} /> Automated Bank Reconciliation Engine
                    </div>
                    <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.45rem', color: 'var(--text-primary)' }}>
                      Connect Your Bank for Real-Time UPI & Bank Sync
                    </h2>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      Syncs 100% of credits, debits, family transfers, and UPI payments directly from official daily e-statements. No manual spreadsheets, no missing SMS.
                    </p>
                  </div>

                  {/* Bank Selection Notice */}
                  <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Select Your Bank:
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                      ⚡ Tamilnad Mercantile Bank (TMB) Ready for Live Sync
                    </span>
                  </div>

                  {/* Bank Cards Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {SUPPORTED_BANKS.map((b) => {
                      const isSelected = selectedBank === b.id;
                      const isHovered = hoveredBankId === b.id;

                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            if (b.active) setSelectedBank(b.id);
                          }}
                          onMouseEnter={() => setHoveredBankId(b.id)}
                          onMouseLeave={() => setHoveredBankId(null)}
                          style={{
                            position: 'relative',
                            padding: '1.25rem 1rem',
                            borderRadius: '14px',
                            border: isSelected
                              ? `2px solid ${b.color}`
                              : '1px solid var(--card-border)',
                            background: isSelected
                              ? b.bgColor
                              : b.active
                              ? 'var(--card-bg)'
                              : 'rgba(255,255,255,0.02)',
                            cursor: b.active ? 'pointer' : 'not-allowed',
                            opacity: b.active ? 1 : 0.65,
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.6rem'
                          }}
                        >
                          {/* Top Tag */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{
                              width: 38,
                              height: 38,
                              borderRadius: '10px',
                              background: b.bgColor,
                              color: b.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.95rem'
                            }}>
                              <Building2 size={20} />
                            </div>

                            <span style={{
                              fontSize: '0.72rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '20px',
                              fontWeight: 600,
                              background: b.active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                              color: b.active ? '#10b981' : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}>
                              {!b.active && <Lock size={10} />}
                              {b.tag}
                            </span>
                          </div>

                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                              {b.shortName}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {b.name}
                            </div>
                          </div>

                          {/* Active Checkmark or Tooltip Indicator */}
                          {isSelected && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.25rem' }}>
                              <CheckCircle2 size={14} /> Selected for Sync
                            </div>
                          )}

                          {/* Hover Tooltip for Upcoming Banks */}
                          {!b.active && isHovered && (
                            <div style={{
                              position: 'absolute',
                              bottom: '-32px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              background: '#0f172a',
                              color: '#f8fafc',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                              zIndex: 10
                            }}>
                              🚀 Feature Engagement: Coming in next update!
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Proceed Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => goToStep(2)}
                      className="btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'var(--accent-primary)',
                        color: '#fff',
                        padding: '0.75rem 1.75rem',
                        borderRadius: '10px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Click to Proceed with TMB Bank <ArrowRight size={17} />
                    </button>
                  </div>

                  {/* UPI Transactions Table Below Bank Selection */}
                  {upiTransactions.length > 0 && (
                    <div style={{ marginTop: '2.5rem' }}>
                      <TransactionsTable
                        title="UPI Transaction History"
                        badge={`Showing ${displayedUpiTransactions.length} transaction(s)`}
                        transactions={displayedUpiTransactions}
                        loading={txLoading}
                        onDelete={handleDeleteTransaction}
                        onEditComplete={refreshAllData}
                        filterElement={renderTxFilterControls()}
                        isBankSyncTable={false}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  STEP 2: CREDENTIALS & SETUP GUIDE
              ──────────────────────────────────────────────────────── */}
              {wizardStep === 2 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                  
                  {/* Selected Bank Banner */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: '12px',
                    padding: '0.85rem 1.25rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Building2 size={20} color="#10b981" />
                      <div>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Configuring Tamilnad Mercantile Bank (TMB)</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Daily statement sync via automated Gmail reader</div>
                      </div>
                    </div>
                    <button
                      onClick={() => goToStep(1)}
                      style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      Change Bank
                    </button>
                  </div>

                  {/* Form Container */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>

                    {/* Section 1: Statement Opening Password */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1', padding: '0.5rem', borderRadius: '10px' }}>
                          <Key size={18} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>E-Statement Opening Password</h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Used by backend to decrypt daily PDF attachments</span>
                        </div>
                      </div>

                      {/* Instruction Notice */}
                      <div style={{
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.25)',
                        borderRadius: '10px',
                        padding: '0.85rem 1rem',
                        fontSize: '0.84rem',
                        color: 'var(--text-primary)',
                        lineHeight: 1.5
                      }}>
                        <strong style={{ color: '#f59e0b' }}>📩 Check Your Bank Email for the Password:</strong><br />
                        Open your daily bank email and check the <em>"About Your Password"</em> section for your account's exact password format (for example: first 4 letters of PAN + last 4 digits of phone number). Enter that exact password below.
                      </div>

                      {hasPassword && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#10b981' }}>
                          <CheckCircle2 size={14} /> Currently saved password: <strong>{maskedPassword}</strong>
                        </div>
                      )}

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                          Enter Password
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={passwordInput}
                            onChange={(e) => handlePasswordChange(e.target.value)}
                            placeholder={hasPassword ? 'Enter new password to change...' : 'e.g. LOUR0005'}
                            style={{
                              width: '100%',
                              padding: '0.7rem 2.5rem 0.7rem 0.9rem',
                              borderRadius: '8px',
                              border: '1px solid var(--card-border)',
                              background: 'var(--empty-state-bg)',
                              color: 'var(--text-primary)',
                              fontSize: '0.92rem'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(p => !p)}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer'
                            }}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Gmail Cloud Credentials */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '0.5rem', borderRadius: '10px' }}>
                          <Mail size={18} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>Google Cloud Credentials</h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Enables automatic inbox scanning for statements</span>
                        </div>
                      </div>

                      {/* Direct Inputs */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                            Bank Registered Gmail Address
                          </label>
                          <input
                            type="email"
                            value={targetBankEmail}
                            onChange={(e) => handleBankEmailChange(e.target.value)}
                            placeholder="e.g. infantrichart06@gmail.com (where TMB sends emails)"
                            style={{
                              width: '100%',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '8px',
                              border: '1px solid var(--card-border)',
                              background: 'var(--empty-state-bg)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem'
                            }}
                          />
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem', lineHeight: 1.4 }}>
                            Enter the specific email that receives your bank's daily e-statements (e.g. your dad's or secondary email).
                          </span>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Google Client ID
                            </label>
                            {hasGoogleCredentials && (
                              <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Check size={12} /> Configured in Database
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={googleClientId}
                            onChange={(e) => handleClientIdChange(e.target.value)}
                            placeholder="e.g. 123456789-xyz.apps.googleusercontent.com"
                            style={{
                              width: '100%',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '8px',
                              border: '1px solid var(--card-border)',
                              background: 'var(--empty-state-bg)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem'
                            }}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Google Client Secret
                            </label>
                            {hasGoogleCredentials && (
                              <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Check size={12} /> Configured in Database
                              </span>
                            )}
                          </div>
                          <input
                            type="password"
                            value={googleClientSecret}
                            onChange={(e) => handleClientSecretChange(e.target.value)}
                            placeholder="e.g. GOCSPX-xxxxxxxxxxxxxx"
                            style={{
                              width: '100%',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '8px',
                              border: '1px solid var(--card-border)',
                              background: 'var(--empty-state-bg)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem'
                            }}
                          />
                        </div>
                      </div>

                      {/* Setup Guide Action & Toggle */}
                      <div style={{ marginTop: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => setShowGuide(g => !g)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.82rem',
                            padding: 0,
                            fontWeight: 600
                          }}
                        >
                          <HelpCircle size={15} />
                          {showGuide ? 'Hide Setup Guide ▴' : 'Need help getting Client ID & Secret? View Full Guide ▾'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ────────────────────────────────────────────────────────
                      FULL WIDTH BRIEF SETUP GUIDE
                  ──────────────────────────────────────────────────────── */}
                  {showGuide && (
                    <div className="animate-fade-in" style={{
                      width: '100%',
                      background: 'var(--empty-state-bg)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '14px',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem'
                    }}>
                      {/* Guide Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.75rem' }}>
                        <div>
                          <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                            📋 Google Cloud Platform: Quick 4-Step Setup Guide
                          </strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Follow these exact brief steps to generate your Client ID & Secret.
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                          <a
                            href="https://console.cloud.google.com"
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: 'rgba(59,130,246,0.1)',
                              border: '1px solid rgba(59,130,246,0.25)',
                              color: '#3b82f6',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              textDecoration: 'none'
                            }}
                          >
                            Open Google Cloud <ExternalLink size={12} />
                          </a>

                          <button
                            type="button"
                            onClick={handleDownloadGuidePdf}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                              color: '#fff',
                              border: 'none',
                              padding: '0.4rem 0.85rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            <Download size={13} /> Download PDF
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowGuide(false)}
                            className="guide-close-btn"
                            title="Hide Setup Guide"
                          >
                            Close Guide ✕
                          </button>
                        </div>
                      </div>

                      {/* 4 Brief Step Cards (Full Width Grid) */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                        {/* Step 1 */}
                        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ background: 'var(--accent-primary)', color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>1</span>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>App Information</strong>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            • App name: <code className="setup-guide-code">Cash & UPI Tracker</code><br />
                            • User support email: <em>Select your email</em>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ background: 'var(--accent-primary)', color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>2</span>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>Audience & Publish</strong>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            • User type: Select <strong>External</strong><br />
                            • Add your Gmail under <strong>Test users</strong><br />
                            • 💡 <strong>Crucial:</strong> Click <strong style={{ color: '#10b981' }}>PUBLISH APP</strong> so your tokens never expire in 7 days!
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ background: 'var(--accent-primary)', color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>3</span>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>Enable Gmail API</strong>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            • Search: <strong style={{ color: 'var(--accent-primary)' }}>Gmail API</strong> in search bar<br />
                            • Click blue <strong>ENABLE</strong> button
                          </div>
                        </div>

                        {/* Step 4 */}
                        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ background: 'var(--accent-primary)', color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>4</span>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>Create Credentials</strong>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            • Go to: <strong>Clients → Create Client</strong><br />
                            • Application type: <strong style={{ color: 'var(--accent-primary)' }}>Web application</strong>
                          </div>
                        </div>
                      </div>

                      {/* Wide Copy-Paste URLs Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                        {/* URL 1 */}
                        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Authorized JavaScript origins:
                          </span>
                          <div className="url-copy-box">
                            <code className="url-copy-code">{window.location.origin}</code>
                            <button
                              type="button"
                              onClick={() => handleCopy(window.location.origin, 'origin')}
                              className="url-copy-btn"
                              style={{ color: copiedKey === 'origin' ? '#10b981' : undefined }}
                            >
                              {copiedKey === 'origin' ? <Check size={14} /> : <Copy size={14} />}
                              {copiedKey === 'origin' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>

                        {/* URL 2 */}
                        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Authorized redirect URIs:
                          </span>
                          <div className="url-copy-box">
                            <code className="url-copy-code">{`${window.location.origin}/google-callback`}</code>
                            <button
                              type="button"
                              onClick={() => handleCopy(`${window.location.origin}/google-callback`, 'redirect')}
                              className="url-copy-btn"
                              style={{ color: copiedKey === 'redirect' ? '#10b981' : undefined }}
                            >
                              {copiedKey === 'redirect' ? <Check size={14} /> : <Copy size={14} />}
                              {copiedKey === 'redirect' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Wizard Footer Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.25rem', borderTop: '1px solid var(--card-border)', flexWrap: 'wrap', gap: '1rem' }}>
                    <button
                      onClick={() => goToStep(1)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: 'none',
                        border: '1px solid var(--card-border)',
                        color: 'var(--text-secondary)',
                        padding: '0.65rem 1.25rem',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }}
                    >
                      <ArrowLeft size={16} /> Back to Banks
                    </button>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <button
                        onClick={handleInitiateConnect}
                        disabled={savingSetup}
                        className="btn"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#fff',
                          padding: '0.65rem 1.5rem',
                          borderRadius: '8px',
                          fontSize: '0.92rem',
                          fontWeight: 600,
                          border: 'none',
                          cursor: savingSetup ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Check size={16} />
                        {savingSetup ? 'Connecting...' : 'Click to Connect'}
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              AUTHENTICATED BANK OVERVIEW & STATEMENT RECONCILIATION
              Dynamic details extracted directly from the user's PDF statement
          ══════════════════════════════════════════════════════════════ */}
          {isConfigured && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }} className="animate-fade-in">

              {/* 1. DYNAMIC CUSTOMER & BRANCH DETAILS CARDS (From PDF Header) */}
              {showBankDetails && bankOverview?.customerDetails && (
                <div
                  className="data-card glass animate-fade-in"
                  style={{
                    padding: '1.25rem 1.5rem',
                    border: '1px solid var(--card-border)',
                    borderRadius: '14px',
                    background: 'var(--card-bg)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Building2 size={16} style={{ color: 'var(--accent-primary, #6366f1)' }} />
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Verified Bank Account & Branch Credentials (from E-Statement)
                      </strong>
                    </div>
                    <button
                      onClick={() => setShowBankDetails(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                      title="Close bank details"
                    >
                      Close ✕
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {/* Left: Customer Details */}
                    <div style={{ background: 'var(--empty-state-bg)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-secondary, #7c3aed)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                        👤 Customer Account Details
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Customer ID:</span>
                          <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bankOverview.customerDetails.customerId || '—'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Account Holder:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{bankOverview.customerDetails.name || '—'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Account No:</span>
                          <span style={{ color: 'var(--success, #10b981)', fontWeight: 700, fontFamily: 'monospace' }}>{bankOverview.accountNo || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>A/c Type:</span>
                          <span style={{ color: 'var(--text-primary)' }}>{bankOverview.customerDetails.accountType || 'Saving Account'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Registered Tel:</span>
                          <span style={{ color: 'var(--text-primary)' }}>{bankOverview.customerDetails.mobile || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Registered Email:</span>
                          <span style={{ color: 'var(--text-primary)' }}>{bankOverview.customerDetails.email || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Branch Details */}
                    {bankOverview.branchDetails && (
                      <div style={{ background: 'var(--empty-state-bg)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-primary, #2563eb)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                          🏛️ Home Branch Information
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Branch Name:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{bankOverview.branchDetails.branchName} (Code: {bankOverview.branchDetails.branchCode})</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>IFSC Code:</span>
                            <span style={{ color: 'var(--accent-primary, #2563eb)', fontWeight: 700, fontFamily: 'monospace' }}>{bankOverview.branchDetails.ifsc || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>MICR Code:</span>
                            <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bankOverview.branchDetails.micr || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Branch Address:</span>
                            <span style={{ color: 'var(--text-primary)', textAlign: 'right', maxWidth: '200px', fontSize: '0.78rem' }}>{bankOverview.branchDetails.address || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Branch Email:</span>
                            <span style={{ color: 'var(--text-primary)' }}>{bankOverview.branchDetails.email || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Customer Care:</span>
                            <span style={{ color: 'var(--success, #10b981)', fontWeight: 700 }}>{bankOverview.branchDetails.customerCare || '+91-9842461461'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dismissible Initial Inbox Sync Notice */}
              {showInitialNotice && isConfigured && (
                <div
                  className="data-card glass animate-fade-in"
                  style={{
                    padding: '0.9rem 1.25rem',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      Bank e-statement ({availableMonths[availableMonths.length - 1]?.label || 'July 2026'} to {availableMonths[0]?.label || 'October 2026'}) is fetched! Now daily transactions will automatically fetch as they come tomorrow.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInitialNotice(false);
                      localStorage.setItem('bank_initial_sync_dismissed', 'true');
                    }}
                    className="btn btn-success"
                    style={{
                      padding: '0.35rem 1.25rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    OK
                  </button>
                </div>
              )}

              {/* 2. DAILY STATEMENT RECONCILIATION TABLE (Row-by-Row Bank Ledger) */}
              {bankOverview?.dailySummaries && bankOverview.dailySummaries.length > 0 && (
                <div
                  className="data-card glass animate-fade-in"
                  style={{
                    padding: '1.25rem',
                    border: '1px solid var(--card-border)',
                    borderRadius: '14px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <FileText size={18} style={{ color: '#10b981' }} />
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        Daily Statement Ledger (Day-by-Day Reconciliation)
                      </strong>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginLeft: '0.5rem', background: 'var(--card-bg)', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                        Showing {displayedDailySummaries.length} statement(s)
                      </span>
                    </div>
                    <div className="filter-wrapper">
                      {renderLedgerFilterControls()}
                    </div>
                  </div>

                  <div className="transaction-table-container" style={{ margin: 0 }}>
                    <table style={{ tableLayout: 'fixed', width: '100%', minWidth: '650px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '130px' }}>Statement Date</th>
                          <th style={{ textAlign: 'right', width: '130px' }}>Opening Balance</th>
                          <th style={{ textAlign: 'right', width: '140px' }}>Total Deposits (+)</th>
                          <th style={{ textAlign: 'right', width: '140px' }}>Total Withdrawals (-)</th>
                          <th style={{ textAlign: 'right', width: '140px' }}>Closing Balance</th>
                          <th style={{ textAlign: 'center', width: '100px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedDailySummaries.map((summary, idx) => (
                          <tr key={summary.period || idx}>
                            <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                              {summary.statementDate || summary.period}
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              ₹{Number(summary.openingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '600', color: '#10b981' }}>
                              {summary.totalDeposits > 0 
                                ? `+₹${Number(summary.totalDeposits).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '600', color: summary.totalWithdrawals > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                              {summary.totalWithdrawals > 0 
                                ? `-₹${Number(summary.totalWithdrawals).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: '#38bdf8', fontSize: '13.5px' }}>
                              ₹{Number(summary.closingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '10.5px',
                                  fontWeight: '600',
                                  color: '#10b981',
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  padding: '2px 6px',
                                  borderRadius: '12px'
                                }}
                              >
                                <CheckCircle2 size={10} /> Synced
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. STATEMENT TRANSACTIONS TABLE (Clean Read-Only Bank Records) */}
              <TransactionsTable
                title="Auto-Tracked Bank & UPI Transactions"
                badge={`Showing ${displayedAutoTransactions.length} transaction(s)`}
                transactions={displayedAutoTransactions}
                loading={txLoading}
                onDelete={handleDeleteTransaction}
                onEditComplete={refreshAllData}
                filterElement={renderTxFilterControls()}
                isBankSyncTable={true}
              />
            </div>
          )}

        </div>
      )}

      {/* ─── MANUAL ENTRY TAB (Preserved for Cash & Quick Add) ─── */}
      {mainTab === 'manual' && (
        <div className="main-content animate-fade-in">
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
              fixedWallet="UPI"
            />
          </div>
          <div className="data-cards">
            <TransactionsTable
              title={`Recent Manual UPI ${subTab === 'spend' ? 'Expenses' : 'Income'}`}
              transactions={transactions.filter(tx => tx.wallet === 'UPI' && (!tx.entryMode || tx.entryMode === 'manual') && tx.type === (subTab === 'spend' ? 'debit' : 'credit'))}
              loading={txLoading}
              onDelete={handleDeleteTransaction}
              onEditComplete={refreshAllData}
              hideWallet={true}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECURE GMAIL ACCESS & PRIVACY CONSENT MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showConsentModal && (
        <div className="consent-modal-backdrop" onClick={() => !savingSetup && setShowConsentModal(false)}>
          <div className="consent-modal-card" onClick={e => e.stopPropagation()} style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldCheck size={26} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                  Secure Gmail Access & Bank Sync Authorization
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Tamilnad Mercantile Bank (TMB) E-Statement Automation Protocol
                </p>
              </div>
            </div>

            {/* Information Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="consent-info-card">
                <span style={{ fontSize: '1.1rem' }}>🔒</span>
                <div>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>Strictly Read-Only Access (`gmail.readonly`)</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.5 }}>
                    The system only searches for emails with subject <code>"TMB Daily E-Statement"</code>. It cannot compose, send, or delete any emails, nor access personal conversations.
                  </div>
                </div>
              </div>

              <div className="consent-info-card">
                <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                <div>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>100% Private Local Processing</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.5 }}>
                    Statements are decrypted in-memory. Your financial data stays in your personal database and is never shared, sold, or synced with external advertisers.
                  </div>
                </div>
              </div>

              <div className="consent-info-card">
                <span style={{ fontSize: '1.1rem' }}>⚡</span>
                <div>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>Automated UPI & Bank Reconciliation</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.5 }}>
                    Incoming debits, credits, and live bank balance will be extracted daily so your expense charts are always up to date.
                  </div>
                </div>
              </div>

              <div className="consent-info-card">
                <span style={{ fontSize: '1.1rem' }}>🔄</span>
                <div>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>Revoke Access Anytime</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.5 }}>
                    You have full sovereignty. You can disconnect bank sync or delete saved credentials at any time in one click.
                  </div>
                </div>
              </div>
            </div>

            {/* Consent Tick Box */}
            <div
              style={{
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer'
              }}
              onClick={() => setConsentAgreed(a => !a)}
            >
              <input
                type="checkbox"
                id="consent-check"
                checked={consentAgreed}
                onChange={e => setConsentAgreed(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer', marginTop: '2px' }}
                onClick={e => e.stopPropagation()}
              />
              <label htmlFor="consent-check" style={{ fontSize: '0.84rem', color: 'var(--text-primary)', cursor: 'pointer', lineHeight: 1.5, userSelect: 'none' }}>
                <strong>I understand and authorize secure read-only Gmail access</strong> for automated TMB daily bank statement synchronization to my expense tracker.
              </label>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                disabled={savingSetup}
                style={{
                  background: 'none',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-secondary)',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAuthorization}
                disabled={!consentAgreed || savingSetup}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: consentAgreed
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'rgba(100,116,139,0.3)',
                  color: consentAgreed ? '#fff' : 'rgba(255,255,255,0.4)',
                  padding: '0.65rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: !consentAgreed || savingSetup ? 'not-allowed' : 'pointer',
                  boxShadow: consentAgreed ? '0 4px 15px rgba(16,185,129,0.3)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {savingSetup ? 'Redirecting to Google...' : 'Authorize & Continue to Google'}
                <ArrowRight size={16} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          LOGIN SUCCESS CELEBRATION MODAL (Vibrant Green Animation)
      ══════════════════════════════════════════════════════════════ */}
      {showSuccessAnimation && (
        <div className="consent-modal-backdrop">
          <div className="success-celebration-card">
            {/* Glowing Ring with Checkmark */}
            <div className="success-glow-ring">
              <CheckCircle2 size={46} color="#10b981" />
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#10b981',
              padding: '0.3rem 0.85rem',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '0.75rem'
            }}>
              <Sparkles size={14} /> CONNECTION & LOGIN SUCCESSFUL
            </div>

            <h2 style={{ fontSize: '1.5rem', color: '#fff', margin: '0 0 0.5rem 0', fontWeight: 800 }}>
              TMB Bank Auto-Sync Connected!
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1.25rem 0', lineHeight: 1.6 }}>
              Secure read-only Gmail access granted. Daily e-statements will be decrypted and synced automatically.
            </p>

            {/* Details Pills */}
            <div style={{
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
              fontSize: '0.82rem',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <span className="pulse-dot-green" />
                <strong>Bank Account:</strong> Tamilnad Mercantile Bank (TMB)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Mail size={13} style={{ color: '#38bdf8' }} />
                <strong>Linked Email:</strong> {targetBankEmail || googleEmail || currentUser?.email}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Clock size={13} style={{ color: '#10b981' }} />
                <strong>Sync Schedule:</strong> Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Daily 10:00 AM
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
              ⚡ Redirecting to live statement view...
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UpiView;
