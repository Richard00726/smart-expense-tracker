import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Wallet, Smartphone, CheckCircle, ArrowRight, ArrowLeft, Download, Bell, Shield, Zap, X, Coins, QrCode, Copy, Check } from 'lucide-react';

const APK_DOWNLOAD_URL = 'https://raw.githubusercontent.com/Richard00726/smart-expense-tracker/main/cash-upi-tracker.apk';
const STEPS = ['welcome', 'cash', 'upi', 'done'];

const OnboardingScreen = ({ onComplete, username = 'there', token, user }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [upiSub, setUpiSub] = useState(0);
  const [qrMode, setQrMode] = useState('login'); // 'login' | 'download'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const step = STEPS[stepIndex];

  const effectiveToken = token || localStorage.getItem('token') || '';
  const effectiveUser = user || JSON.parse(localStorage.getItem('user') || '{}');
  const userEmail = effectiveUser.email || '';

  const mobileLoginUrl = effectiveToken 
    ? `https://cash-upi-backend.onrender.com/api/auth/mobile-login?token=${encodeURIComponent(effectiveToken)}`
    : APK_DOWNLOAD_URL;

  useEffect(() => {
    const generateQrCode = async () => {
      try {
        const textToEncode = qrMode === 'login' ? mobileLoginUrl : APK_DOWNLOAD_URL;
        const url = await QRCode.toDataURL(textToEncode, {
          width: 220,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error('QR code generation error:', err);
      }
    };
    generateQrCode();
  }, [qrMode, mobileLoginUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(mobileLoginUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const finish = () => { localStorage.setItem('onboarding_done', 'true'); onComplete(); };

  const upiSteps = [
    { 
      icon: <QrCode size={34} color="#3b82f6" />, 
      title: 'Scan QR in Android App to Log In', 
      desc: 'Open the Smart Expense Tracker app on your phone, tap "Scan QR Code to Log In", and point your phone at this screen.' 
    },
    { 
      icon: <Smartphone size={34} color="#10b981" />, 
      title: 'Install the Android App', 
      desc: 'If you have not installed the app yet, download and install the APK on your phone.' 
    },
    { 
      icon: <Bell size={34} color="#f59e0b" />, 
      title: 'Enable Notification Access', 
      desc: 'Allow the app to read bank SMS so transactions sync automatically in real-time.' 
    },
  ];

  const progress = step === 'welcome' ? 5 : step === 'cash' ? 50 : step === 'upi' ? 55 + (upiSub / 3) * 35 : 100;

  const btnStyle = (color1, color2, shadow) => ({
    flex: 1, padding: '0.75rem', borderRadius: 12,
    background: `linear-gradient(135deg,${color1},${color2})`,
    color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    boxShadow: `0 4px 15px ${shadow}`, fontSize: '0.95rem'
  });

  const backBtn = (onClick) => (
    <button onClick={onClick} style={{
      padding: '0.7rem 1rem', borderRadius: 12, border: '1px solid var(--card-border)',
      background: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem'
    }}>
      <ArrowLeft size={15} /> Back
    </button>
  );

  const stepRow = (items, accentColor) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'left' }}>
      {items.map((text, i) => (
        <div key={i} style={{
          display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.7rem 0.9rem',
          background: `rgba(${accentColor},0.07)`, borderRadius: 10, border: `1px solid rgba(${accentColor},0.15)`
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', background: `rgb(${accentColor})`,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '0.78rem', flexShrink: 0
          }}>{i + 1}</div>
          <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.5 }}>{text}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-gradient)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem', fontFamily: 'var(--font-main)'
    }}>
      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--card-border)' }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', width: `${progress}%`, transition: 'width 0.5s ease' }} />
      </div>

      {/* Skip */}
      {step !== 'done' && (
        <button onClick={finish} style={{
          position: 'absolute', top: '1.25rem', right: '1.25rem',
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          color: 'var(--text-secondary)', padding: '0.4rem 0.85rem', borderRadius: 8,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.83rem'
        }}>
          <X size={13} /> Skip
        </button>
      )}

      {/* Card */}
      <div className="glass animate-fade-in" style={{
        width: '100%', maxWidth: 520, borderRadius: 24, padding: '2rem',
        border: '1px solid var(--card-border)', boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
        maxHeight: '92vh', overflowY: 'auto'
      }}>

        {/* ── WELCOME ── */}
        {step === 'welcome' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 74, height: 74, borderRadius: '50%', margin: '0 auto 1.25rem', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(59,130,246,0.4)' }}>
              <Wallet size={32} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Welcome, {username}! 👋</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.6 }}>Let's get your Smart Expense Tracker set up. How do you want to track money?</p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {[
                { icon: <Coins size={36} color="#10b981" />, title: '💵 Cash (Manual)', desc: 'Enter transactions manually. Works right away.', color: '16,185,129', action: () => setStepIndex(1) },
                { icon: <Smartphone size={36} color="#3b82f6" />, title: '📲 UPI (Auto)', desc: 'Auto-capture bank SMS & UPI transactions.', color: '59,130,246', action: () => { setStepIndex(2); setUpiSub(0); } },
              ].map((card, i) => (
                <div key={i} onClick={card.action} style={{
                  flex: 1, minWidth: 150, padding: '1.2rem', borderRadius: 16, cursor: 'pointer',
                  border: `2px solid rgba(${card.color},0.25)`, background: `rgba(${card.color},0.06)`,
                  textAlign: 'center', transition: 'all 0.2s'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `rgb(${card.color})`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `rgba(${card.color},0.25)`; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ marginBottom: 10 }}>{card.icon}</div>
                  <h3 style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '0.95rem' }}>{card.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{card.desc}</p>
                </div>
              ))}
            </div>
            <button onClick={finish} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.87rem' }}>Skip for now →</button>
          </div>
        )}

        {/* ── CASH ── */}
        {step === 'cash' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 66, height: 66, borderRadius: '50%', margin: '0 auto 0.9rem', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Coins size={30} color="#10b981" />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.35rem' }}>Cash Tracking</h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Simple manual entry — just a few taps.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', marginBottom: '1.75rem' }}>
              {[['➕', 'Add Money', 'Add Money tab → Enter amount & note → Save.'], ['➖', 'Spend Money', 'Spend Money tab → Enter what you spent → Save.'], ['📊', 'View History', 'All transactions appear instantly in Dashboard.']].map(([icon, title, desc], i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.8rem 1rem', background: 'rgba(16,185,129,0.06)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.15)' }}>
                  <span style={{ fontSize: '1.35rem', flexShrink: 0 }}>{icon}</span>
                  <div><p style={{ margin: '0 0 0.18rem', fontWeight: 600, fontSize: '0.9rem' }}>{title}</p><p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{desc}</p></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {backBtn(() => setStepIndex(0))}
              <button onClick={finish} style={btnStyle('#10b981', '#059669', 'rgba(16,185,129,0.3)')}>Go to Dashboard <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {/* ── UPI ── */}
        {step === 'upi' && (
          <div>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
              {upiSteps.map((_, i) => (<div key={i} style={{ height: 4, flex: 1, borderRadius: 4, background: i <= upiSub ? 'linear-gradient(90deg,#3b82f6,#8b5cf6)' : 'var(--card-border)', transition: 'background 0.3s' }} />))}
            </div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              {upiSteps[upiSub].icon}
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.6rem 0 0.35rem' }}>{upiSteps[upiSub].title}</h2>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.25rem', fontSize: '0.88rem' }}>{upiSteps[upiSub].desc}</p>

              {/* Sub-step 0: QR Login & Download */}
              {upiSub === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}>
                  {/* Mode Selector */}
                  <div style={{
                    display: 'flex',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '4px',
                    borderRadius: 12,
                    border: '1px solid var(--card-border)',
                    gap: '4px'
                  }}>
                    <button
                      onClick={() => setQrMode('login')}
                      style={{
                        padding: '0.45rem 0.9rem',
                        borderRadius: 8,
                        border: 'none',
                        background: qrMode === 'login' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'transparent',
                        color: qrMode === 'login' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Zap size={13} /> Instant Login QR
                    </button>
                    <button
                      onClick={() => setQrMode('download')}
                      style={{
                        padding: '0.45rem 0.9rem',
                        borderRadius: 8,
                        border: 'none',
                        background: qrMode === 'download' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                        color: qrMode === 'download' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Download size={13} /> Download App QR
                    </button>
                  </div>

                  {/* QR Code Card */}
                  <div style={{
                    width: 190,
                    height: 190,
                    background: '#ffffff',
                    borderRadius: 16,
                    padding: 12,
                    boxShadow: '0 10px 30px rgba(59, 130, 246, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {qrDataUrl ? (
                      <img 
                        src={qrDataUrl} 
                        alt="QR Code" 
                        style={{ width: '100%', height: '100%', borderRadius: 8, display: 'block' }} 
                      />
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Generating QR...</div>
                    )}
                  </div>

                  {/* Context Info */}
                  {qrMode === 'login' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                      {userEmail && (
                        <div style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: 20,
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          fontSize: '0.78rem',
                          color: '#60a5fa',
                          fontWeight: 500
                        }}>
                          👤 {userEmail}
                        </div>
                      )}
                      <p style={{ fontSize: '0.84rem', color: '#60a5fa', margin: '2px 0 0', fontWeight: 600 }}>
                        📲 Open app on phone → tap "Scan QR Code to Log In"
                      </p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Or point your phone's camera at this screen
                      </p>
                      <button
                        onClick={handleCopyLink}
                        style={{
                          background: 'none',
                          border: '1px solid var(--card-border)',
                          borderRadius: 8,
                          color: 'var(--text-secondary)',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          marginTop: 4
                        }}
                      >
                        {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                        {copied ? 'Link Copied!' : 'Copy Mobile Login Link'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                        📷 Scan to download APK on your phone
                      </p>
                      <a 
                        href={APK_DOWNLOAD_URL} 
                        download="smart-expense-tracker.apk" 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.45rem', 
                          padding: '0.5rem 1rem', 
                          background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', 
                          color: '#fff', 
                          borderRadius: 10, 
                          fontWeight: 600, 
                          textDecoration: 'none', 
                          fontSize: '0.82rem' 
                        }}
                      >
                        <Download size={14} /> Direct APK Download
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-step 1: Install steps */}
              {upiSub === 1 && stepRow([
                'If you already installed your app, simply scan the QR code in Step 1 to log in!',
                'If not installed: Download the APK file on your Android phone.',
                'Open Downloads and tap the APK file → tap "Install anyway".',
                'Launch Smart Expense Tracker on your device.'
              ], '16,185,129')}

              {/* Sub-step 2: Notification permission */}
              {upiSub === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'left' }}>
                  {stepRow([
                    'Open Smart Expense Tracker on your phone.',
                    'Tap "Enable Notification Access" on the tracker setup screen.',
                    'Find "Smart Expense Tracker" in the list and toggle it ON.',
                    'Accept the permission dialog so UPI & bank SMS are automatically recorded.'
                  ], '245,158,11')}
                  <div style={{ padding: '0.7rem 0.9rem', background: 'rgba(59,130,246,0.07)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.15)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginTop: 4 }}>
                    <Shield size={14} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ margin: 0, fontSize: '0.79rem', color: 'var(--text-secondary)' }}>We only parse official bank transaction notifications — never personal messages. Data is securely encrypted.</p>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {backBtn(() => { if (upiSub === 0) setStepIndex(0); else setUpiSub(s => s - 1); })}
              <button onClick={() => { if (upiSub < upiSteps.length - 1) setUpiSub(s => s + 1); else setStepIndex(3); }} style={btnStyle('#3b82f6', '#8b5cf6', 'rgba(59,130,246,0.3)')}>
                {upiSub < upiSteps.length - 1 ? <> Next <ArrowRight size={15} /> </> : <> I've set it up! <CheckCircle size={15} /> </>}
              </button>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 74, height: 74, borderRadius: '50%', margin: '0 auto 1.25rem', background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(16,185,129,0.4)' }}>
              <CheckCircle size={36} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, margin: '0 0 0.6rem' }}>You're All Set! 🎉</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>Your UPI auto-tracking is configured. Bank SMS notifications will now sync automatically to your dashboard!</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem', textAlign: 'left' }}>
              {[[<Zap size={14} color="#f59e0b" />, 'Transactions sync in real-time'], [<Shield size={14} color="#3b82f6" />, 'Works on 4G/5G — no shared Wi-Fi needed'], [<Bell size={14} color="#10b981" />, 'Offline queue syncs when back online']].map(([icon, text], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.65rem 0.9rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid var(--card-border)' }}>{icon}<span style={{ fontSize: '0.86rem' }}>{text}</span></div>
              ))}
            </div>
            <button onClick={finish} style={{ ...btnStyle('#3b82f6', '#8b5cf6', 'rgba(59,130,246,0.4)'), width: '100%', padding: '0.85rem', fontSize: '1rem', borderRadius: 14 }}>
              Go to Dashboard <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingScreen;
